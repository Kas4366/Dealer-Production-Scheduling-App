import { useState, useEffect } from 'react';
import { supabase, DailySchedule, Dealer, DAY_NAMES } from '../lib/supabase';
import {
  ChevronLeft, ChevronRight, Loader2, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, ArrowRight, Plus, RotateCcw
} from 'lucide-react';

const fmt = (d: Date) => d.toISOString().split('T')[0];

function getWeekDates(anchor: Date): Date[] {
  const d = new Date(anchor);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 6 }, (_, i) => {
    const wd = new Date(d);
    wd.setDate(d.getDate() + i);
    return wd;
  });
}

type ChangeModalState = {
  slot: DailySchedule;
  type: 'cancel' | 'move' | 'extra';
};

export default function WeeklySchedule() {
  const [anchor, setAnchor] = useState(new Date());
  const [slots, setSlots] = useState<DailySchedule[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [changeModal, setChangeModal] = useState<ChangeModalState | null>(null);
  const [saving, setSaving] = useState(false);

  const weekDates = getWeekDates(anchor);
  const startDate = weekDates[0];
  const endDate = weekDates[5];

  const fetchData = async () => {
    setLoading(true);
    const [{ data: schedData }, { data: dealerData }] = await Promise.all([
      supabase
        .from('daily_schedule')
        .select('*, dealer:dealers(*)')
        .gte('slot_date', fmt(startDate))
        .lte('slot_date', fmt(endDate))
        .order('scheduled_time'),
      supabase.from('dealers').select('*').eq('active', true).order('name'),
    ]);
    setSlots(schedData || []);
    setDealers(dealerData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [anchor]);

  const changeWeek = (delta: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(d);
  };

  const slotsForDate = (d: Date) =>
    slots.filter(s => s.slot_date === fmt(d)).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

  const statusIcon = (slot: DailySchedule) => {
    if (slot.status === 'cancelled') return <XCircle size={12} className="text-slate-400" />;
    if (slot.status === 'moved_out') return <ArrowRight size={12} className="text-amber-500" />;
    if (slot.status === 'extra') return <Plus size={12} className="text-emerald-500" />;
    if (slot.change_type === 'moved_in') return <ArrowRight size={12} className="text-sky-500 rotate-180" />;
    return <CheckCircle2 size={12} className="text-slate-300" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => changeWeek(-1)} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} –{' '}
              {endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </h2>
          </div>
          <button onClick={() => changeWeek(1)} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAnchor(new Date())}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            This Week
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <RefreshCw size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-sky-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {weekDates.map((d, i) => {
            const daySlots = slotsForDate(d);
            const isToday = fmt(d) === fmt(new Date());
            const totalBottles = daySlots
              .filter(s => s.status === 'scheduled' || s.status === 'extra')
              .reduce((a, s) => a + s.planned_19l + s.planned_10l, 0);

            return (
              <div
                key={i}
                className={`bg-white rounded-xl border ${isToday ? 'border-sky-300 ring-1 ring-sky-200' : 'border-slate-200'}`}
              >
                <div className={`px-3 py-2 rounded-t-xl border-b ${isToday ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{DAY_NAMES[i].slice(0, 3)}</div>
                  <div className={`text-sm font-bold ${isToday ? 'text-sky-700' : 'text-slate-800'}`}>
                    {d.getDate()} {d.toLocaleDateString('en-AU', { month: 'short' })}
                  </div>
                  {totalBottles > 0 && (
                    <div className="text-xs text-slate-400 mt-0.5">{totalBottles} bottles</div>
                  )}
                </div>
                <div className="p-2 space-y-1 min-h-[80px]">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-300 text-center py-3">—</p>
                  ) : (
                    daySlots.map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => setChangeModal({ slot, type: 'cancel' })}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors group ${
                          slot.status === 'cancelled' || slot.status === 'moved_out'
                            ? 'opacity-40 hover:opacity-60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {statusIcon(slot)}
                          <span className={`font-medium ${slot.status === 'cancelled' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {slot.dealer?.code}
                          </span>
                        </div>
                        <div className="text-slate-400 pl-4">
                          {slot.scheduled_time.slice(0, 5)} · {slot.planned_19l}×19L
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly totals */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Weekly Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Total Deliveries</p>
              <p className="text-xl font-bold text-slate-900">
                {slots.filter(s => s.status === 'scheduled' || s.status === 'extra').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total 19L</p>
              <p className="text-xl font-bold text-slate-900">
                {slots.filter(s => s.status === 'scheduled' || s.status === 'extra').reduce((a, s) => a + s.planned_19l, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Cancelled</p>
              <p className="text-xl font-bold text-red-500">
                {slots.filter(s => s.status === 'cancelled').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Extras Added</p>
              <p className="text-xl font-bold text-emerald-600">
                {slots.filter(s => s.status === 'extra').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {changeModal && (
        <SlotActionModal
          slot={changeModal.slot}
          dealers={dealers}
          onClose={() => setChangeModal(null)}
          onAction={async (action, data) => {
            setSaving(true);
            if (action === 'cancel') {
              await supabase.from('daily_schedule')
                .update({ status: 'cancelled', change_type: 'cancelled', change_note: data.note || '' })
                .eq('id', changeModal.slot.id);
            } else if (action === 'restore') {
              await supabase.from('daily_schedule')
                .update({ status: 'scheduled', change_type: null, change_note: '' })
                .eq('id', changeModal.slot.id);
            } else if (action === 'extra') {
              await supabase.from('daily_schedule').insert({
                slot_date: changeModal.slot.slot_date,
                dealer_id: data.dealer_id,
                scheduled_time: data.time,
                planned_19l: data.planned_19l,
                planned_10l: data.planned_10l,
                status: 'extra',
                change_type: 'extra',
                change_note: data.note || '',
              });
            }
            setSaving(false);
            setChangeModal(null);
            fetchData();
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

function SlotActionModal({
  slot,
  dealers,
  onClose,
  onAction,
  saving,
}: {
  slot: DailySchedule;
  dealers: Dealer[];
  onClose: () => void;
  onAction: (action: string, data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [note, setNote] = useState('');
  const [extraForm, setExtraForm] = useState({
    dealer_id: '',
    time: '08:00',
    planned_19l: 0,
    planned_10l: 0,
    note: '',
  });
  const [mode, setMode] = useState<'actions' | 'extra'>('actions');

  const isCancelled = slot.status === 'cancelled' || slot.status === 'moved_out';

  if (mode === 'extra') {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Add Extra Slot</h3>
            <p className="text-sm text-slate-500">{new Date(slot.slot_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dealer</label>
              <select value={extraForm.dealer_id} onChange={e => setExtraForm(f => ({ ...f, dealer_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">Select dealer...</option>
                {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
              <input type="time" value={extraForm.time}
                onChange={e => setExtraForm(f => ({ ...f, time: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">19L Bottles</label>
                <input type="number" min={0} value={extraForm.planned_19l}
                  onChange={e => setExtraForm(f => ({ ...f, planned_19l: +e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">10L Bottles</label>
                <input type="number" min={0} value={extraForm.planned_10l}
                  onChange={e => setExtraForm(f => ({ ...f, planned_10l: +e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
              <input type="text" value={extraForm.note}
                onChange={e => setExtraForm(f => ({ ...f, note: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Optional reason" />
            </div>
          </div>
          <div className="p-5 border-t border-slate-100 flex gap-3">
            <button onClick={() => setMode('actions')} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={() => onAction('extra', extraForm)}
              disabled={saving || !extraForm.dealer_id}
              className="flex-1 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Add Slot
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{slot.dealer?.name}</h3>
          <p className="text-sm text-slate-500">
            {new Date(slot.slot_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} at {slot.scheduled_time.slice(0, 5)}
          </p>
        </div>
        <div className="p-5 space-y-3">
          {!isCancelled && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note (optional)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Reason for change" />
              </div>
              <button
                onClick={() => onAction('cancel', { note })}
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-2"
              >
                <XCircle size={15} />
                Cancel This Slot
              </button>
            </>
          )}
          {isCancelled && (
            <button
              onClick={() => onAction('restore', {})}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} />
              Restore Slot
            </button>
          )}
          <button
            onClick={() => setMode('extra')}
            className="w-full py-2.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-sm font-medium hover:bg-sky-100 flex items-center justify-center gap-2"
          >
            <Plus size={15} />
            Add Extra Slot This Day
          </button>
        </div>
        <div className="p-5 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
