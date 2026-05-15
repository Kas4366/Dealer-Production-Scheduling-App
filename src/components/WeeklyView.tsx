import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useWeeklyTemplates, useDealers } from '../hooks/useData';
import { DAY_NAMES, DAY_SHORT, formatTime, getDealerColor } from '../lib/utils';
import type { WeeklyTemplateWithDealer } from '../lib/database.types';
import TimeInput from './TimeInput';
import { supabase } from '../lib/supabase';

export default function WeeklyView() {
  const { templates, loading, reload } = useWeeklyTemplates();
  const { dealers } = useDealers();

  // Build grid: for each day, list of slots sorted by time
  const days = [0, 1, 2, 3, 4, 5];
  const byDay = days.map(d => templates.filter(t => t.day_of_week === d).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
  const dayTotals19 = byDay.map(slots => slots.reduce((sum, s) => sum + s.planned_19l, 0));
  const dayTotals10 = byDay.map(slots => slots.reduce((sum, s) => sum + s.planned_10l, 0));
  const dayTotals = dayTotals19.map((v, i) => v + dayTotals10[i]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Weekly Template</h1>
          <p className="text-sm text-slate-500">Recurring schedule used to generate daily slots</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[680px]">
            {/* Header */}
            <div className="grid grid-cols-6 gap-2 mb-3">
              {DAY_NAMES.map((name, i) => (
                <div key={name} className="text-center">
                  <div className="text-sm font-bold text-slate-700">{DAY_SHORT[i]}</div>
                  <div className="text-[10px] text-blue-600 mt-0.5 font-medium">{dayTotals19[i]}×19L</div>
                  <div className="text-[10px] text-cyan-600 font-medium">{dayTotals10[i]}×10L</div>
                </div>
              ))}
            </div>

            {/* Slot cards */}
            <div className="grid grid-cols-6 gap-2 items-start">
              {byDay.map((slots, dayIdx) => (
                <div key={dayIdx} className="space-y-2">
                  {slots.map(slot => (
                    <WeeklySlotCard
                      key={slot.id}
                      slot={slot}
                      onDelete={async () => {
                        const { error } = await supabase
                          .from('weekly_schedule_templates')
                          .delete()
                          .eq('id', slot.id);
                        if (error) throw new Error(error.message);
                        await reload();
                      }}
                    />
                  ))}
                  <AddSlotButton dayOfWeek={dayIdx} dealers={dealers} onAdded={reload} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly totals */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700 mb-3">Weekly Bottle Totals</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {DAY_NAMES.map((name, i) => (
            <div key={name} className="text-center bg-slate-50 rounded-lg p-2">
              <div className="text-xs text-slate-500 mb-1">{DAY_SHORT[i]}</div>
              <div className="text-xs font-bold text-blue-600">{dayTotals19[i]} <span className="font-normal text-slate-400">19L</span></div>
              <div className="text-xs font-bold text-cyan-600">{dayTotals10[i]} <span className="font-normal text-slate-400">10L</span></div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
          <span className="text-sm text-slate-500">Total weekly bottles</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-blue-600">{dayTotals19.reduce((a, b) => a + b, 0)} <span className="font-normal text-slate-400 text-xs">19L</span></span>
            <span className="text-slate-300">·</span>
            <span className="text-sm font-bold text-cyan-600">{dayTotals10.reduce((a, b) => a + b, 0)} <span className="font-normal text-slate-400 text-xs">10L</span></span>
            <span className="text-slate-300">·</span>
            <span className="text-xl font-bold text-slate-800">{dayTotals.reduce((a, b) => a + b, 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklySlotCard({ slot, onDelete }: { slot: WeeklyTemplateWithDealer; onDelete: () => Promise<void> }) {
  const color = getDealerColor(slot.dealer_id);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to remove');
      setDeleting(false);
    }
  };

  if (confirming) {
    return (
      <div className={`rounded-lg border p-2 ${color.light} ${color.border}`}>
        <div className="text-xs font-semibold text-slate-700 mb-1.5">Remove slot?</div>
        {deleteError && (
          <div className="text-xs text-red-500 mb-1.5 leading-tight">{deleteError}</div>
        )}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { setConfirming(false); setDeleteError(null); }}
            className="flex-1 text-xs py-1 border border-slate-200 rounded text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 text-xs py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {deleting ? '...' : 'Remove'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group rounded-lg border p-2 transition-all ${color.light} ${color.border} relative`}>
      <div className={`text-xs font-bold ${color.text}`}>{slot.dealer.code}</div>
      <div className="text-xs text-slate-600 font-medium truncate">{slot.dealer.name.split(' ')[0]}</div>
      <div className="text-xs text-slate-500">{formatTime(slot.scheduled_time)}</div>
      <div className="text-xs font-semibold text-slate-700 mt-0.5">
        {slot.planned_19l > 0 && <span className="text-blue-600">{slot.planned_19l}</span>}
        {slot.planned_19l > 0 && slot.planned_10l > 0 && <span className="text-slate-400"> / </span>}
        {slot.planned_10l > 0 && <span className="text-cyan-600">{slot.planned_10l}</span>}
      </div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center font-bold hover:bg-red-600 transition-colors hidden group-hover:flex"
      >
        ×
      </button>
    </div>
  );
}

function AddSlotButton({ dayOfWeek, dealers, onAdded }: {
  dayOfWeek: number;
  dealers: any[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dealerId, setDealerId] = useState('');
  const [time, setTime] = useState('08:00');
  const [qty19l, setQty19l] = useState('0');
  const [qty10l, setQty10l] = useState('0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!dealerId) return;
    setSaving(true);
    await supabase.from('weekly_schedule_templates').insert({
      dealer_id: dealerId,
      day_of_week: dayOfWeek,
      scheduled_time: time,
      planned_19l: parseInt(qty19l) || 0,
      planned_10l: parseInt(qty10l) || 0,
      sort_order: 0,
    });
    setSaving(false);
    setOpen(false);
    setDealerId('');
    onAdded();
  };

  if (open) {
    return (
      <div className="bg-white rounded-lg border border-blue-300 p-2 shadow-md space-y-2">
        <select
          value={dealerId}
          onChange={e => setDealerId(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          <option value="">Select dealer</option>
          {dealers.filter(d => d.active).map(d => (
            <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
          ))}
        </select>
        <TimeInput value={time} onChange={setTime} className="w-full text-xs py-1 px-1.5" />
        <div className="flex gap-1">
          <input type="number" placeholder="19L" min="0" value={qty19l} onChange={e => setQty19l(e.target.value)}
            className="w-1/2 text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="number" placeholder="10L" min="0" value={qty10l} onChange={e => setQty10l(e.target.value)}
            className="w-1/2 text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOpen(false)}
            className="flex-1 text-xs py-1 border border-slate-200 rounded text-slate-500 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !dealerId}
            className="flex-1 text-xs py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700">
            {saving ? '...' : 'Add'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center justify-center py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
    >
      <Plus size={14} />
    </button>
  );
}