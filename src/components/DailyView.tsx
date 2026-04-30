import { useState, useEffect } from 'react';
import { supabase, DailySchedule, VisitRecord, ProductionSettings, Holiday, getDealerColor, getDealerBg, formatDate } from '../lib/supabase';
import { ChevronLeft, ChevronRight, Clock, Package, CheckCircle2, AlertCircle, Plus, CreditCard as Edit2, Loader2, RefreshCw, Zap, X, Save, Copy, Share2 } from 'lucide-react';

type SlotWithVisit = DailySchedule & { visit?: VisitRecord };

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

export default function DailyView() {
  const [date, setDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [slots, setSlots] = useState<SlotWithVisit[]>([]);
  const [settings, setSettings] = useState<ProductionSettings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [generatedDates, setGeneratedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [visitModal, setVisitModal] = useState<SlotWithVisit | null>(null);
  const [extraModal, setExtraModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const dateStr = formatDate(date);
    const monthStart = formatDate(calMonth);
    const monthEnd = formatDate(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0));

    const [{ data: scheduleData }, { data: visitData }, { data: settingsData }, { data: holidayData }, { data: generatedData }] = await Promise.all([
      supabase
        .from('daily_schedule')
        .select('*, dealer:dealers(*), swapped_with_dealer:dealers!daily_schedule_swapped_with_dealer_id_fkey(*)')
        .eq('slot_date', dateStr)
        .order('scheduled_time'),
      supabase.from('visit_records').select('*, dealer:dealers(*)').eq('slot_date', dateStr),
      supabase.from('production_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('holidays').select('*'),
      supabase.from('daily_schedule').select('slot_date').gte('slot_date', monthStart).lte('slot_date', monthEnd),
    ]);

    if (settingsData) setSettings(settingsData);
    setHolidays(holidayData || []);
    setGeneratedDates(new Set((generatedData || []).map((r: { slot_date: string }) => r.slot_date)));

    const visitMap = new Map<string, VisitRecord>();
    (visitData || []).forEach((v: VisitRecord) => visitMap.set(v.daily_schedule_id, v));
    setSlots((scheduleData || []).map((s: DailySchedule) => ({ ...s, visit: visitMap.get(s.id) })));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [date]);

  const fetchMonthData = async () => {
    const monthStart = formatDate(calMonth);
    const monthEnd = formatDate(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0));
    const { data } = await supabase.from('daily_schedule').select('slot_date').gte('slot_date', monthStart).lte('slot_date', monthEnd);
    setGeneratedDates(new Set((data || []).map((r: { slot_date: string }) => r.slot_date)));
  };

  useEffect(() => { fetchMonthData(); }, [calMonth]);

  const handleGeneratePlan = async () => {
    const dateStr = formatDate(date);
    // day_of_week: 0=Mon..5=Sat (JS: 0=Sun,1=Mon..6=Sat)
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0 scale
    if (dayOfWeek > 5) {
      alert('No template slots for Sunday.');
      return;
    }

    const isHoliday = holidays.some(h => h.holiday_date === dateStr);
    if (isHoliday) {
      if (!confirm('This is a holiday. Generate plan anyway?')) return;
    }

    const existing = slots.filter(s => s.status === 'scheduled');
    if (existing.length > 0) {
      if (!confirm(`${existing.length} scheduled slot(s) already exist for this day. Generate again and merge?`)) return;
    }

    setGenerating(true);
    const { data: templates } = await supabase
      .from('weekly_schedule_templates')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .order('sort_order');

    if (templates && templates.length > 0) {
      const toInsert = templates.map((t: { dealer_id: string; scheduled_time: string; planned_19l: number; planned_10l: number; id: string }) => ({
        slot_date: dateStr,
        dealer_id: t.dealer_id,
        scheduled_time: t.scheduled_time,
        planned_19l: t.planned_19l,
        planned_10l: t.planned_10l,
        status: 'scheduled',
        template_slot_id: t.id,
      }));
      await supabase.from('daily_schedule').insert(toInsert);
    }
    setGenerating(false);
    fetchData();
  };

  const totalPlanned = slots.filter(s => s.status === 'scheduled' || s.status === 'extra')
    .reduce((a, s) => a + s.planned_19l + s.planned_10l, 0);
  const totalFilled = slots.filter(s => s.visit?.status === 'completed')
    .reduce((a, s) => a + (s.visit?.bottles_19l_out ?? 0) + (s.visit?.bottles_10l_out ?? 0), 0);

  const dateStr = formatDate(date);
  const isHoliday = holidays.some(h => h.holiday_date === dateStr);
  const hasSlots = slots.length > 0;

  const shareText = () => {
    const lines = [
      `IVO Production Planner - ${date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      ``,
      ...slots
        .filter(s => s.status === 'scheduled' || s.status === 'extra')
        .map(s => {
          const status = s.visit?.status ? ` [${s.visit.status.toUpperCase()}]` : '';
          return `${s.scheduled_time.slice(0, 5)} ${s.dealer?.name} — ${s.planned_19l}x19L ${s.planned_10l}x10L${status}`;
        }),
      ``,
      `Total Planned: ${totalPlanned} bottles | Filled: ${totalFilled} bottles`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    alert('Summary copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Calendar widget */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-white font-semibold text-sm">
              {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
            </h3>
            <button
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-xs text-white/60 font-semibold py-1">{d}</div>
            ))}
          </div>
          <CalendarGrid
            calMonth={calMonth}
            selectedDate={date}
            holidays={holidays}
            generatedDates={generatedDates}
            onSelect={d => setDate(d)}
          />
        </div>

        {/* Selected date info bar */}
        <div className="px-5 py-3 flex items-center justify-between bg-white">
          <div>
            <div className="font-semibold text-slate-900 text-sm">
              {date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {formatDate(date) === formatDate(new Date()) && (
                <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">Today</span>
              )}
              {isHoliday && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  Holiday — {holidays.find(h => h.holiday_date === dateStr)?.name}
                </span>
              )}
              {hasSlots && (
                <span className="text-xs text-slate-400">{slots.filter(s => s.status !== 'cancelled').length} slots · {totalPlanned} bottles</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDate(new Date())} className="text-xs px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium">
              Today
            </button>
            <button onClick={fetchData} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleGeneratePlan}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors shadow-sm disabled:opacity-60"
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          Generate Plan
        </button>
        <button
          onClick={() => setExtraModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <Plus size={15} />
          Add Extra Slot
        </button>
        {hasSlots && (
          <button
            onClick={shareText}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors ml-auto"
          >
            <Share2 size={15} />
            Copy Summary
          </button>
        )}
      </div>

      {/* Summary cards */}
      {hasSlots && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-sky-50 rounded-xl p-4">
            <div className="text-xs font-medium text-sky-700 opacity-80">Total Slots</div>
            <div className="text-2xl font-bold text-sky-700 mt-1">{slots.filter(s => s.status !== 'cancelled' && s.status !== 'moved_out').length}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-xs font-medium text-blue-700 opacity-80">Planned Bottles</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{totalPlanned}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-xs font-medium text-emerald-700 opacity-80">Completed</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{slots.filter(s => s.visit?.status === 'completed').length}</div>
          </div>
          <div className="bg-teal-50 rounded-xl p-4">
            <div className="text-xs font-medium text-teal-700 opacity-80">Bottles Filled</div>
            <div className="text-2xl font-bold text-teal-700 mt-1">{totalFilled}</div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {settings && totalPlanned > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Daily Progress</span>
            <span className="text-sm font-semibold text-slate-900">{totalFilled} / {totalPlanned} bottles</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-sky-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalFilled / totalPlanned) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-slate-400">{Math.round((totalFilled / totalPlanned) * 100)}% complete</span>
            <span className="text-xs text-slate-400">{totalPlanned - totalFilled} remaining</span>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-sky-500" />
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
              <AlertCircle size={26} className="text-slate-300" />
            </div>
          </div>
          <p className="text-slate-500 font-medium">No deliveries scheduled</p>
          <p className="text-slate-400 text-sm mt-1">Click "Generate Plan" to load today's slots from the template</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => {
            const color = slot.dealer ? getDealerColor(slot.dealer) : '#94a3b8';
            const bg = getDealerBg(color, 0.06);
            const badge = getStatusBadge(slot);
            const isActive = slot.status === 'scheduled' || slot.status === 'extra';

            return (
              <div
                key={slot.id}
                className={`bg-white rounded-xl border overflow-hidden transition-all ${
                  isActive ? 'border-slate-200 hover:shadow-sm' : 'border-slate-100 opacity-60'
                }`}
                style={isActive ? { borderLeft: `4px solid ${color}` } : {}}
              >
                <div className="p-4 flex items-center gap-4" style={isActive ? { background: bg } : {}}>
                  <div className="flex items-center gap-1.5 text-slate-500 min-w-[60px]">
                    <Clock size={13} className="text-slate-400" />
                    <span className="text-sm font-mono font-medium text-slate-700">{slot.scheduled_time.slice(0, 5)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{slot.dealer?.name}</span>
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded font-semibold text-white"
                        style={{ background: color }}
                      >
                        {slot.dealer?.code}
                      </span>
                      {slot.change_type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          {slot.change_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Package size={11} />
                        {slot.planned_19l} × 19L
                        {slot.planned_10l > 0 && `, ${slot.planned_10l} × 10L`}
                      </span>
                      {slot.visit?.status === 'completed' && (
                        <span className="text-xs text-emerald-600 font-medium">
                          Filled: {slot.visit.bottles_19l_out} × 19L
                          {slot.visit.bottles_10l_out > 0 && `, ${slot.visit.bottles_10l_out} × 10L`}
                        </span>
                      )}
                    </div>
                    {slot.change_note && (
                      <p className="text-xs text-amber-600 mt-0.5">{slot.change_note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {isActive && (
                      <button
                        onClick={() => setVisitModal(slot)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                      >
                        {slot.visit ? <Edit2 size={15} /> : <Plus size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visitModal && (
        <VisitModal
          slot={visitModal}
          onClose={() => setVisitModal(null)}
          onSave={async (data) => {
            setSaving(true);
            if (visitModal.visit) {
              await supabase.from('visit_records').update({ ...data, updated_at: new Date().toISOString() }).eq('id', visitModal.visit.id);
            } else {
              await supabase.from('visit_records').insert({
                daily_schedule_id: visitModal.id,
                slot_date: visitModal.slot_date,
                dealer_id: visitModal.dealer_id,
                ...data,
              });
            }
            setSaving(false);
            setVisitModal(null);
            fetchData();
          }}
          saving={saving}
        />
      )}

      {extraModal && (
        <ExtraSlotModal
          date={dateStr}
          onClose={() => setExtraModal(false)}
          onSave={async (data) => {
            setSaving(true);
            await supabase.from('daily_schedule').insert({ ...data, slot_date: dateStr, status: 'extra', change_type: 'extra' });
            setSaving(false);
            setExtraModal(false);
            fetchData();
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

function CalendarGrid({
  calMonth,
  selectedDate,
  holidays,
  generatedDates,
  onSelect,
}: {
  calMonth: Date;
  selectedDate: Date;
  holidays: Holiday[];
  generatedDates: Set<string>;
  onSelect: (d: Date) => void;
}) {
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  // JS: 0=Sun, make Mon=0
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = formatDate(new Date());
  const selected = formatDate(selectedDate);
  const holidayDates = new Set(holidays.map(h => h.holiday_date));

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((day, i) => {
        if (!day) return <div key={`empty-${i}`} />;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const isSelected = dateStr === selected;
        const isHoliday = holidayDates.has(dateStr);
        const hasSlots = generatedDates.has(dateStr);

        return (
          <button
            key={day}
            onClick={() => onSelect(new Date(year, month, day))}
            className={`relative w-full aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all ${
              isSelected
                ? 'bg-white text-sky-700 shadow-sm font-bold'
                : isToday
                ? 'bg-white/20 text-white'
                : 'text-white/80 hover:bg-white/20'
            }`}
          >
            <span className={isToday && !isSelected ? 'underline underline-offset-2' : ''}>{day}</span>
            <div className="flex items-center gap-0.5 mt-0.5">
              {hasSlots && (
                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-sky-500' : 'bg-white/60'}`} />
              )}
              {isHoliday && (
                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-red-400' : 'bg-red-300'}`} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getStatusBadge(slot: SlotWithVisit) {
  if (slot.status === 'cancelled') return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' };
  if (slot.status === 'moved_out') return { label: 'Moved Out', cls: 'bg-amber-50 text-amber-700' };
  if (!slot.visit) return { label: 'Scheduled', cls: 'bg-sky-50 text-sky-700' };
  const s = slot.visit.status;
  if (s === 'completed') return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' };
  if (s === 'arrived') return { label: 'Arrived', cls: 'bg-blue-50 text-blue-700' };
  if (s === 'no_show') return { label: 'No Show', cls: 'bg-red-50 text-red-700' };
  return { label: 'Pending', cls: 'bg-slate-100 text-slate-600' };
}

type VisitFormData = {
  status: 'pending' | 'arrived' | 'completed' | 'no_show';
  actual_arrival_time: string;
  bottles_19l_in: number;
  bottles_19l_out: number;
  bottles_10l_in: number;
  bottles_10l_out: number;
  notes: string;
  recorded_by: string;
};

function VisitModal({ slot, onClose, onSave, saving }: {
  slot: SlotWithVisit;
  onClose: () => void;
  onSave: (data: VisitFormData) => void;
  saving: boolean;
}) {
  const color = slot.dealer ? getDealerColor(slot.dealer) : '#0ea5e9';
  const [form, setForm] = useState<VisitFormData>({
    status: slot.visit?.status ?? 'pending',
    actual_arrival_time: slot.visit?.actual_arrival_time ?? '',
    bottles_19l_in: slot.visit?.bottles_19l_in ?? 0,
    bottles_19l_out: slot.visit?.bottles_19l_out ?? slot.planned_19l,
    bottles_10l_in: slot.visit?.bottles_10l_in ?? 0,
    bottles_10l_out: slot.visit?.bottles_10l_out ?? slot.planned_10l,
    notes: slot.visit?.notes ?? '',
    recorded_by: slot.visit?.recorded_by ?? '',
  });

  const set = (k: keyof VisitFormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const STATUS_OPTS = [
    { key: 'pending', label: 'Pending' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'completed', label: 'Completed' },
    { key: 'no_show', label: 'No Show' },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between" style={{ borderTop: `3px solid ${color}` }}>
          <div>
            <h3 className="font-semibold text-slate-900">{slot.visit ? 'Update Visit' : 'Record Visit'}</h3>
            <p className="text-sm text-slate-500">{slot.dealer?.name} — {slot.scheduled_time.slice(0, 5)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => set('status', s.key)}
                  className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.status === s.key
                      ? 'text-white border-transparent'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                  style={form.status === s.key ? { background: color, borderColor: color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actual Arrival Time</label>
            <input type="time" value={form.actual_arrival_time} onChange={e => set('actual_arrival_time', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">19L In (empties)</label>
              <input type="number" min={0} value={form.bottles_19l_in} onChange={e => set('bottles_19l_in', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">19L Out (filled)</label>
              <input type="number" min={0} value={form.bottles_19l_out} onChange={e => set('bottles_19l_out', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">10L In (empties)</label>
              <input type="number" min={0} value={form.bottles_10l_in} onChange={e => set('bottles_10l_in', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">10L Out (filled)</label>
              <input type="number" min={0} value={form.bottles_10l_out} onChange={e => set('bottles_10l_out', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Recorded By</label>
            <input type="text" value={form.recorded_by} onChange={e => set('recorded_by', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Staff name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" placeholder="Optional notes" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: color }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {slot.visit ? 'Update' : 'Save Visit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtraSlotModal({ date, onClose, onSave, saving }: {
  date: string;
  onClose: () => void;
  onSave: (data: { dealer_id: string; scheduled_time: string; planned_19l: number; planned_10l: number }) => void;
  saving: boolean;
}) {
  const [dealers, setDealers] = useState<Array<{ id: string; name: string; color: string; code: string }>>([]);
  const [form, setForm] = useState({ dealer_id: '', scheduled_time: '09:00', planned_19l: 0, planned_10l: 0 });

  useEffect(() => {
    supabase.from('dealers').select('id,name,color,code').eq('active', true).order('name').then(({ data }) => {
      setDealers(data || []);
      if (data && data.length > 0) setForm(f => ({ ...f, dealer_id: data[0].id }));
    });
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const selectedDealer = dealers.find(d => d.id === form.dealer_id);
  const color = selectedDealer?.color || '#0ea5e9';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Add Extra Slot</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dealer</label>
            <select value={form.dealer_id} onChange={e => set('dealer_id', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
            <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">19L Bottles</label>
              <input type="number" min={0} value={form.planned_19l} onChange={e => set('planned_19l', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">10L Bottles</label>
              <input type="number" min={0} value={form.planned_10l} onChange={e => set('planned_10l', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.dealer_id}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: color }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Add Slot
          </button>
        </div>
      </div>
    </div>
  );
}
