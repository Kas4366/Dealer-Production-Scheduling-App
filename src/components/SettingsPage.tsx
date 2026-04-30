import { useState, useEffect } from 'react';
import { supabase, ProductionSettings, Holiday, DailySchedule, DAY_NAMES, getDealerColor, getDealerBg } from '../lib/supabase';
import { Save, Loader2, Plus, Trash2, ExternalLink, Settings2, Calendar, RotateCcw, ArrowRight, AlertTriangle, CheckCircle2, X } from 'lucide-react';

type RedistLog = {
  id: string;
  holiday_date: string;
  action: string;
  affected_slot_ids: string[];
  created_at: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<ProductionSettings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [redistLogs, setRedistLogs] = useState<RedistLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [redistModal, setRedistModal] = useState<Holiday | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: s }, { data: h }, { data: logs }] = await Promise.all([
      supabase.from('production_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('holidays').select('*').order('holiday_date'),
      supabase.from('slot_redistribution_log').select('*').order('created_at', { ascending: false }),
    ]);
    setSettings(s);
    setHolidays(h || []);
    setRedistLogs(logs || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from('production_settings').update({
      fill_speed_per_hour: settings.fill_speed_per_hour,
      morning_break_start: settings.morning_break_start,
      morning_break_duration: settings.morning_break_duration,
      lunch_break_start: settings.lunch_break_start,
      lunch_break_duration: settings.lunch_break_duration,
      day_start: settings.day_start,
      day_end: settings.day_end,
      daily_capacity_override: settings.daily_capacity_override,
      sheets_id: settings.sheets_id,
      sheets_url: settings.sheets_url,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (k: keyof ProductionSettings, v: unknown) =>
    setSettings(s => s ? { ...s, [k]: v } : s);

  const addHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) return;
    setAddingHoliday(true);
    await supabase.from('holidays').insert({ holiday_date: newHoliday.date, name: newHoliday.name });
    setNewHoliday({ date: '', name: '' });
    setAddingHoliday(false);
    fetchData();
  };

  const deleteHoliday = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    await supabase.from('holidays').delete().eq('id', id);
    fetchData();
  };

  const handleUndoRedist = async (holidayDate: string) => {
    if (!confirm('Undo the slot redistribution for this holiday? This will delete the moved-in slots.')) return;
    const log = redistLogs.find(l => l.holiday_date === holidayDate && l.action === 'redistribute');
    if (!log) return;
    await supabase.from('daily_schedule').delete().in('id', log.affected_slot_ids);
    await supabase.from('slot_redistribution_log').insert({
      holiday_date: holidayDate,
      action: 'undo',
      affected_slot_ids: log.affected_slot_ids,
      slot_snapshot: [],
    });
    fetchData();
  };

  const calcDailyCapacity = () => {
    if (!settings) return 0;
    if (settings.daily_capacity_override) return settings.daily_capacity_override;
    const [sh, sm] = settings.day_start.split(':').map(Number);
    const [eh, em] = settings.day_end.split(':').map(Number);
    const totalMins = (eh * 60 + em) - (sh * 60 + sm);
    const breakMins = settings.morning_break_duration + settings.lunch_break_duration;
    const workMins = totalMins - breakMins;
    return Math.floor((workMins / 60) * settings.fill_speed_per_hour);
  };

  const hasUndoable = (hDate: string) => {
    const logs = redistLogs.filter(l => l.holiday_date === hDate);
    if (logs.length === 0) return false;
    const last = logs[0];
    return last.action === 'redistribute';
  };

  const hasRedistributed = (hDate: string) => redistLogs.some(l => l.holiday_date === hDate && l.action === 'redistribute');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Configure production parameters and holidays</p>
      </div>

      {/* Production settings */}
      {settings && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <Settings2 size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800">Production Settings</h3>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Day Start</label>
                <input type="time" value={settings.day_start.slice(0, 5)}
                  onChange={e => set('day_start', e.target.value + ':00')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Day End</label>
                <input type="time" value={settings.day_end.slice(0, 5)}
                  onChange={e => set('day_end', e.target.value + ':00')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fill Speed (bottles/hour)</label>
              <input type="number" min={1} value={settings.fill_speed_per_hour}
                onChange={e => set('fill_speed_per_hour', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Morning Break Start</label>
                <input type="time" value={settings.morning_break_start.slice(0, 5)}
                  onChange={e => set('morning_break_start', e.target.value + ':00')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Duration (mins)</label>
                <input type="number" min={0} value={settings.morning_break_duration}
                  onChange={e => set('morning_break_duration', +e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Lunch Break Start</label>
                <input type="time" value={settings.lunch_break_start.slice(0, 5)}
                  onChange={e => set('lunch_break_start', e.target.value + ':00')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Duration (mins)</label>
                <input type="number" min={0} value={settings.lunch_break_duration}
                  onChange={e => set('lunch_break_duration', +e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Daily Capacity Override</label>
              <input type="number" min={0} value={settings.daily_capacity_override ?? ''}
                onChange={e => set('daily_capacity_override', e.target.value === '' ? null : +e.target.value)}
                placeholder={`Auto: ${calcDailyCapacity()} bottles`}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              <p className="text-xs text-slate-400 mt-1">
                Auto-calculated capacity: <strong>{calcDailyCapacity()} bottles/day</strong>
              </p>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Google Sheets</h4>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sheet ID</label>
                <input type="text" value={settings.sheets_id || ''}
                  onChange={e => set('sheets_id', e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Google Sheets document ID" />
              </div>
              {settings.sheets_url && (
                <a href={settings.sheets_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-sky-600 hover:text-sky-700">
                  <ExternalLink size={12} />
                  Open Google Sheet
                </a>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  saved ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white hover:bg-sky-700'
                } disabled:opacity-60`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holidays */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <Calendar size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800">Public Holidays</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={newHoliday.date}
                onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input type="text" value={newHoliday.name}
                onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))}
                placeholder="e.g. Australia Day"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <button onClick={addHoliday} disabled={addingHoliday || !newHoliday.date || !newHoliday.name}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-60 flex items-center gap-1.5">
              {addingHoliday ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>

          {holidays.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No holidays configured</p>
          ) : (
            <div className="space-y-2">
              {holidays.map(h => {
                const undoable = hasUndoable(h.holiday_date);
                const redistributed = hasRedistributed(h.holiday_date);
                return (
                  <div key={h.id} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{h.name}</span>
                        {redistributed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 size={10} /> Redistributed
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(h.holiday_date + 'T00:00:00').toLocaleDateString('en-AU', {
                          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!redistributed && (
                        <button
                          onClick={() => setRedistModal(h)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          <ArrowRight size={12} />
                          Redistribute
                        </button>
                      )}
                      {undoable && (
                        <button
                          onClick={() => handleUndoRedist(h.holiday_date)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          <RotateCcw size={12} />
                          Undo
                        </button>
                      )}
                      <button onClick={() => deleteHoliday(h.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {redistModal && (
        <RedistributionModal
          holiday={redistModal}
          dailyCapacity={calcDailyCapacity()}
          onClose={() => setRedistModal(null)}
          onDone={() => { setRedistModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function RedistributionModal({
  holiday,
  dailyCapacity,
  onClose,
  onDone,
}: {
  holiday: Holiday;
  dailyCapacity: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [templates, setTemplates] = useState<Array<DailySchedule & { dealer?: { name: string; code: string; color: string } }>>([]);
  const [dayTotals, setDayTotals] = useState<Record<number, number>>({});
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const holidayDate = new Date(holiday.holiday_date + 'T00:00:00');
  const jsDay = holidayDate.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: tData }, { data: weekData }] = await Promise.all([
        supabase.from('weekly_schedule_templates')
          .select('*, dealer:dealers(name,code,color)')
          .eq('day_of_week', dayOfWeek),
        supabase.from('weekly_schedule_templates').select('day_of_week, planned_19l, planned_10l'),
      ]);

      const totals: Record<number, number> = {};
      for (let i = 0; i <= 5; i++) {
        totals[i] = (weekData || [])
          .filter((t: { day_of_week: number }) => t.day_of_week === i)
          .reduce((a: number, t: { planned_19l: number; planned_10l: number }) => a + t.planned_19l + t.planned_10l, 0);
      }
      setDayTotals(totals);

      const slots = (tData || []) as Array<DailySchedule & { dealer?: { name: string; code: string; color: string } }>;
      setTemplates(slots);
      const init: Record<string, number> = {};
      slots.forEach((s: { id: string }) => { init[s.id] = (dayOfWeek + 1) % 6; });
      setAssignments(init);
      setLoading(false);
    })();
  }, []);

  const previewTotals = () => {
    const preview: Record<number, number> = { ...dayTotals };
    templates.forEach(t => {
      const targetDay = assignments[t.id];
      if (targetDay !== undefined) {
        preview[targetDay] = (preview[targetDay] || 0) + t.planned_19l + t.planned_10l;
      }
    });
    return preview;
  };

  const handleSave = async () => {
    setSaving(true);
    // Get the week containing the holiday
    const hDate = new Date(holiday.holiday_date + 'T00:00:00');
    const weekStart = new Date(hDate);
    // Find Monday of that week
    const dayDiff = hDate.getDay() === 0 ? 6 : hDate.getDay() - 1;
    weekStart.setDate(weekStart.getDate() - dayDiff);

    const insertedIds: string[] = [];

    for (const template of templates) {
      const targetDayOffset = assignments[template.id];
      const targetDate = new Date(weekStart);
      targetDate.setDate(weekStart.getDate() + targetDayOffset);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { data: inserted } = await supabase.from('daily_schedule').insert({
        slot_date: targetDateStr,
        dealer_id: template.dealer_id,
        scheduled_time: template.scheduled_time,
        planned_19l: template.planned_19l,
        planned_10l: template.planned_10l,
        status: 'scheduled',
        change_type: 'moved_in',
        original_date: holiday.holiday_date,
        change_note: `Redistributed from ${holiday.name}`,
        template_slot_id: template.id,
      }).select('id');

      if (inserted) insertedIds.push(...inserted.map((r: { id: string }) => r.id));
    }

    await supabase.from('slot_redistribution_log').insert({
      holiday_date: holiday.holiday_date,
      action: 'redistribute',
      affected_slot_ids: insertedIds,
      slot_snapshot: [],
    });

    setSaving(false);
    onDone();
  };

  const preview = previewTotals();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Redistribute Holiday Slots</h3>
            <p className="text-sm text-slate-500">{holiday.name} — {new Date(holiday.holiday_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-sky-500" /></div>
        ) : (
          <>
            <div className="p-5 space-y-3">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle size={24} className="mx-auto text-amber-400 mb-2" />
                  <p className="text-slate-500 text-sm">No template slots for {DAY_NAMES[dayOfWeek]}</p>
                </div>
              ) : (
                templates.map(slot => {
                  const color = slot.dealer?.color || '#94a3b8';
                  const bg = getDealerBg(color, 0.07);
                  return (
                    <div key={slot.id} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-3 p-3" style={{ background: bg }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: color }}>
                          {slot.dealer?.code?.slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 text-sm">{slot.dealer?.name}</div>
                          <div className="text-xs text-slate-500">{slot.scheduled_time?.slice(0, 5)} · {slot.planned_19l}×19L {slot.planned_10l}×10L</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Move to</span>
                          <select
                            value={assignments[slot.id] ?? 0}
                            onChange={e => setAssignments(a => ({ ...a, [slot.id]: Number(e.target.value) }))}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            {DAY_NAMES.map((d, i) => i !== dayOfWeek && (
                              <option key={i} value={i}>{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Capacity preview */}
            {templates.length > 0 && (
              <div className="px-5 pb-5">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Capacity Impact</h4>
                <div className="space-y-1.5">
                  {DAY_NAMES.map((day, i) => {
                    if (i === dayOfWeek) return null;
                    const base = dayTotals[i] || 0;
                    const total = preview[i] || 0;
                    const pct = Math.min(100, Math.round((total / dailyCapacity) * 100));
                    const over = total > dailyCapacity;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600">{day}</span>
                          <span className={over ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                            {total} / {dailyCapacity} {over && '(over capacity!)'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${over ? 'bg-red-500' : 'bg-sky-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || templates.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Redistribution
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
