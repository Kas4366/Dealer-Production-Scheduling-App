import { useState, useEffect } from 'react';
import { supabase, WeeklyTemplate, Dealer, DAY_NAMES, DAY_SHORT, getDealerColor, getDealerBg } from '../lib/supabase';
import { Plus, Trash2, Loader2, Save, X, Clock, Package } from 'lucide-react';

export default function TemplateSchedule() {
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ dealer?: Dealer; slot?: WeeklyTemplate } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: tData }, { data: dData }] = await Promise.all([
      supabase.from('weekly_schedule_templates').select('*, dealer:dealers(*)').order('sort_order'),
      supabase.from('dealers').select('*').eq('active', true).order('name'),
    ]);
    setTemplates(tData || []);
    setDealers(dData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (form: Partial<WeeklyTemplate> & { dealer_id: string }) => {
    setSaving(true);
    if (modal?.slot) {
      await supabase.from('weekly_schedule_templates').update({
        dealer_id: form.dealer_id,
        day_of_week: form.day_of_week,
        scheduled_time: form.scheduled_time,
        planned_19l: form.planned_19l || 0,
        planned_10l: form.planned_10l || 0,
      }).eq('id', modal.slot.id);
    } else {
      const count = templates.filter(t => t.day_of_week === form.day_of_week && t.dealer_id === form.dealer_id).length;
      await supabase.from('weekly_schedule_templates').insert({
        dealer_id: form.dealer_id,
        day_of_week: form.day_of_week,
        scheduled_time: form.scheduled_time,
        planned_19l: form.planned_19l || 0,
        planned_10l: form.planned_10l || 0,
        sort_order: count,
      });
    }
    setSaving(false);
    setModal(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template slot?')) return;
    await supabase.from('weekly_schedule_templates').delete().eq('id', id);
    fetchData();
  };

  const dealerTotals = (dealer: Dealer) => {
    const slots = templates.filter(t => t.dealer_id === dealer.id);
    return {
      slots: slots.length,
      bottles: slots.reduce((a, t) => a + t.planned_19l + t.planned_10l, 0),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Weekly Schedule Templates</h2>
          <p className="text-sm text-slate-500">Recurring delivery slots per dealer — generates the daily plan each week</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Add Slot
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{dealers.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Active Dealers</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{templates.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Slots</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">
            {templates.reduce((a, t) => a + t.planned_19l, 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Weekly 19L Bottles</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">
            {templates.reduce((a, t) => a + t.planned_10l, 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Weekly 10L Bottles</div>
        </div>
      </div>

      {/* Dealer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dealers.map(dealer => {
          const color = getDealerColor(dealer);
          const bg = getDealerBg(color, 0.06);
          const totals = dealerTotals(dealer);
          const dealerSlots = templates
            .filter(t => t.dealer_id === dealer.id)
            .sort((a, b) => a.day_of_week - b.day_of_week || a.scheduled_time.localeCompare(b.scheduled_time));

          return (
            <div
              key={dealer.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Card header */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ background: bg, borderBottom: `2px solid ${color}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                    style={{ background: color }}
                  >
                    {dealer.code}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{dealer.name}</div>
                    <div className="text-xs text-slate-500">{totals.slots} slots · {totals.bottles} bottles/wk</div>
                  </div>
                </div>
                <button
                  onClick={() => setModal({ dealer })}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/60"
                  style={{ color }}
                  title="Add slot for this dealer"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Slots by day */}
              <div className="divide-y divide-slate-50">
                {DAY_NAMES.map((_, dayIdx) => {
                  const daySlots = dealerSlots.filter(t => t.day_of_week === dayIdx);
                  if (daySlots.length === 0) return null;
                  return (
                    <div key={dayIdx} className="px-4 py-2.5">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                        {DAY_SHORT[dayIdx]}
                      </div>
                      <div className="space-y-1.5">
                        {daySlots.map(slot => (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between group rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setModal({ dealer, slot })}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: color }}
                              />
                              <span className="font-mono text-sm text-slate-700">
                                {slot.scheduled_time.slice(0, 5)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500">
                                <span className="font-medium text-slate-700">{slot.planned_19l}</span> × 19L
                              </span>
                              <span className="text-xs text-slate-500">
                                <span className="font-medium text-slate-700">{slot.planned_10l}</span> × 10L
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(slot.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {dealerSlots.length === 0 && (
                  <div className="px-4 py-5 text-center">
                    <p className="text-sm text-slate-400">No slots configured</p>
                    <button
                      onClick={() => setModal({ dealer })}
                      className="mt-1 text-xs font-medium transition-colors"
                      style={{ color }}
                    >
                      Add first slot
                    </button>
                  </div>
                )}
              </div>

              {/* Add slot footer */}
              <div className="px-4 py-2.5 border-t border-slate-100">
                <button
                  onClick={() => setModal({ dealer })}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Plus size={13} />
                  Add slot for {dealer.name}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal !== null && (
        <SlotModal
          dealers={dealers}
          slot={modal.slot}
          defaultDealer={modal.dealer}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function SlotModal({
  dealers,
  slot,
  defaultDealer,
  onClose,
  onSave,
  saving,
}: {
  dealers: Dealer[];
  slot?: WeeklyTemplate;
  defaultDealer?: Dealer;
  onClose: () => void;
  onSave: (form: Partial<WeeklyTemplate> & { dealer_id: string }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    dealer_id: slot?.dealer_id ?? defaultDealer?.id ?? dealers[0]?.id ?? '',
    day_of_week: slot?.day_of_week ?? 0,
    scheduled_time: slot?.scheduled_time?.slice(0, 5) ?? '08:00',
    planned_19l: slot?.planned_19l ?? 0,
    planned_10l: slot?.planned_10l ?? 0,
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const selectedDealer = dealers.find(d => d.id === form.dealer_id);
  const color = selectedDealer ? getDealerColor(selectedDealer) : '#0ea5e9';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{slot ? 'Edit Slot' : 'Add Template Slot'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dealer</label>
            <select
              value={form.dealer_id}
              onChange={e => set('dealer_id', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
              <select
                value={form.day_of_week}
                onChange={e => set('day_of_week', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Clock size={12} /> Time</label>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={e => set('scheduled_time', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Package size={12} /> 19L Bottles</label>
              <input
                type="number"
                min={0}
                value={form.planned_19l}
                onChange={e => set('planned_19l', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Package size={12} /> 10L Bottles</label>
              <input
                type="number"
                min={0}
                value={form.planned_10l}
                onChange={e => set('planned_10l', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form as Partial<WeeklyTemplate> & { dealer_id: string })}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-60"
            style={{ background: color }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {slot ? 'Save Changes' : 'Add Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}
