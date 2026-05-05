import React, { useState, useCallback } from 'react';
import { Sun, Trash2, Plus, ArrowRight, AlertTriangle, Check, Undo2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useHolidays, useDailySchedule, useDealers } from '../hooks/useData';
import { formatDate, formatTime, getWeekDates, getDayOfWeek, DAY_NAMES } from '../lib/utils';
import type { DailyScheduleWithDealer } from '../lib/database.types';
import TimeInput from './TimeInput';

export default function HolidaysView() {
  const { holidays, reload } = useHolidays();
  const [addDate, setAddDate] = useState('');
  const [addName, setAddName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'redistribute' | 'undo'>('redistribute');

  const handleAdd = async () => {
    if (!addDate || !addName) return;
    setSaving(true);
    await supabase.from('holidays').insert({ holiday_date: addDate, name: addName });
    setAddDate('');
    setAddName('');
    setSaving(false);
    reload();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('holidays').delete().eq('id', id);
    reload();
  };

  const openPanel = (id: string, mode: 'redistribute' | 'undo') => {
    if (selectedHoliday === id && panelMode === mode) {
      setSelectedHoliday(null);
    } else {
      setSelectedHoliday(id);
      setPanelMode(mode);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Holiday Management</h1>
        <p className="text-sm text-slate-500">Mark holidays, redistribute dealer slots, and undo changes</p>
      </div>

      {/* Add holiday */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700 mb-3">Add Holiday</div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="date"
            value={addDate}
            onChange={e => setAddDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
          <input
            type="text"
            placeholder="Holiday name"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !addDate || !addName}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Holiday list */}
      {holidays.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Sun size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No holidays added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {holidays.map(h => (
            <div key={h.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                  <Sun size={18} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{h.name}</div>
                  <div className="text-sm text-slate-500">{formatDate(h.holiday_date)} — {DAY_NAMES[getDayOfWeek(h.holiday_date)]}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openPanel(h.id, 'undo')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                      selectedHoliday === h.id && panelMode === 'undo'
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    <Undo2 size={12} />
                    Undo
                  </button>
                  <button
                    onClick={() => openPanel(h.id, 'redistribute')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                      selectedHoliday === h.id && panelMode === 'redistribute'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <RefreshCw size={12} />
                    Redistribute
                  </button>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {selectedHoliday === h.id && panelMode === 'redistribute' && (
                <RedistributePanel
                  holidayDate={h.holiday_date}
                  holidayName={h.name}
                  onClose={() => setSelectedHoliday(null)}
                />
              )}

              {selectedHoliday === h.id && panelMode === 'undo' && (
                <UndoPanel
                  holidayDate={h.holiday_date}
                  holidayName={h.name}
                  onClose={() => setSelectedHoliday(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Redistribute Panel
// ─────────────────────────────────────────────────────────
function RedistributePanel({ holidayDate, holidayName, onClose }: {
  holidayDate: string;
  holidayName: string;
  onClose: () => void;
}) {
  const { slots, loading, reload } = useDailySchedule([holidayDate]);
  const weekDates = getWeekDatesForDate(holidayDate);
  const otherDates = weekDates.filter(d => d !== holidayDate);
  const { slots: otherSlots } = useDailySchedule(otherDates);

  const activeSlots = slots.filter(s => s.status === 'scheduled');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [newTimes, setNewTimes] = useState<Record<string, string>>({});
  const [newQty19, setNewQty19] = useState<Record<string, string>>({});
  const [newQty10, setNewQty10] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Base bottles per day from already-scheduled slots
  const baseBottles19ByDay: Record<string, number> = {};
  const baseBottles10ByDay: Record<string, number> = {};
  otherDates.forEach(d => {
    baseBottles19ByDay[d] = otherSlots
      .filter(s => s.slot_date === d && s.status !== 'moved_out')
      .reduce((sum, s) => sum + s.planned_19l, 0);
    baseBottles10ByDay[d] = otherSlots
      .filter(s => s.slot_date === d && s.status !== 'moved_out')
      .reduce((sum, s) => sum + s.planned_10l, 0);
  });

  // Live totals: base + slots currently assigned to each day in the UI (using overridden qty when set)
  const getLiveTotal = (targetDate: string) => {
    const pending19 = activeSlots
      .filter(s => assignments[s.id] === targetDate)
      .reduce((sum, s) => sum + (parseInt(newQty19[s.id] ?? '') || s.planned_19l), 0);
    const pending10 = activeSlots
      .filter(s => assignments[s.id] === targetDate)
      .reduce((sum, s) => sum + (parseInt(newQty10[s.id] ?? '') || s.planned_10l), 0);
    return {
      total19: (baseBottles19ByDay[targetDate] ?? 0) + pending19,
      total10: (baseBottles10ByDay[targetDate] ?? 0) + pending10,
    };
  };

  const handleAssign = (slotId: string, slot: { scheduled_time: string; planned_19l: number; planned_10l: number }, targetDate: string) => {
    setAssignments(prev => ({ ...prev, [slotId]: targetDate }));
    // Pre-fill time and quantity inputs with original values on first selection
    if (targetDate && targetDate !== 'cancel') {
      if (!newTimes[slotId]) setNewTimes(prev => ({ ...prev, [slotId]: slot.scheduled_time }));
      if (!newQty19[slotId]) setNewQty19(prev => ({ ...prev, [slotId]: String(slot.planned_19l) }));
      if (!newQty10[slotId]) setNewQty10(prev => ({ ...prev, [slotId]: String(slot.planned_10l) }));
    }
  };

  const handleApply = async () => {
    setSaving(true);
    for (const slot of activeSlots) {
      const targetDate = assignments[slot.id];
      if (!targetDate) continue;

      if (targetDate === 'cancel') {
        await supabase.from('daily_schedule')
          .update({ status: 'cancelled', change_type: 'cancelled', change_note: `Cancelled due to ${holidayName}` })
          .eq('id', slot.id);
      } else {
        const scheduledTime = newTimes[slot.id] || slot.scheduled_time;
        const planned19l = parseInt(newQty19[slot.id] ?? '') || slot.planned_19l;
        const planned10l = parseInt(newQty10[slot.id] ?? '') || slot.planned_10l;
        await supabase.from('daily_schedule')
          .update({ status: 'moved_out', change_type: 'moved_out', change_note: `Moved to ${DAY_NAMES[getDayOfWeek(targetDate)]} due to ${holidayName}` })
          .eq('id', slot.id);
        await supabase.from('daily_schedule').insert({
          slot_date: targetDate,
          dealer_id: slot.dealer_id,
          scheduled_time: scheduledTime,
          planned_19l,
          planned_10l,
          status: 'scheduled',
          change_type: 'moved_in',
          original_date: holidayDate,
          change_note: `Moved from ${holidayName} (${formatDate(holidayDate)})`,
          template_slot_id: slot.template_slot_id,
        });
      }
    }
    setSaving(false);
    setDone(true);
    reload();
    setTimeout(onClose, 1500);
  };

  if (loading) return <div className="px-4 pb-4 text-sm text-slate-400">Loading slots...</div>;

  if (activeSlots.length === 0) {
    return (
      <div className="border-t border-slate-100 bg-slate-50 p-4 text-center text-sm text-slate-500">
        No active slots on this day to redistribute.
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-500" />
        <span className="text-sm font-semibold text-slate-700">Redistribute {activeSlots.length} slots from {holidayName}</span>
      </div>
      <div className="text-xs text-slate-500">Choose a day and arrival time for each slot, or cancel it.</div>

      {activeSlots.map(slot => {
        const targetDate = assignments[slot.id];
        const hasDate = targetDate && targetDate !== 'cancel' && targetDate !== '';
        const live = hasDate ? getLiveTotal(targetDate) : null;

        return (
          <div key={slot.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Slot info row */}
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800 truncate">{slot.dealer.name}</div>
                <div className="text-xs text-slate-500">
                  {formatTime(slot.scheduled_time)}
                  <span className="mx-1">·</span>
                  <span className="text-blue-600">{slot.planned_19l} 19L</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span className="text-cyan-600">{slot.planned_10l} 10L</span>
                </div>
              </div>
              <ArrowRight size={14} className="text-slate-400 shrink-0" />
              <select
                value={assignments[slot.id] ?? ''}
                onChange={e => handleAssign(slot.id, slot, e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">-- Keep --</option>
                <option value="cancel">Cancel slot</option>
                {otherDates.map(d => {
                  const { total19, total10 } = getLiveTotal(d);
                  return (
                    <option key={d} value={d}>
                      {DAY_NAMES[getDayOfWeek(d)]} · {total19} 19L · {total10} 10L
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Arrival time, quantities, and live total — shown when a date is selected */}
            {hasDate && (
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 space-y-2.5">
                {/* Row 1: arrival time */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 font-medium mb-1">Arrival Time</div>
                    <TimeInput
                      value={newTimes[slot.id] ?? slot.scheduled_time}
                      onChange={v => setNewTimes(prev => ({ ...prev, [slot.id]: v }))}
                      className="w-full text-xs py-1.5 px-2"
                    />
                  </div>
                </div>
                {/* Row 2: qty overrides */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                      19L Qty
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={newQty19[slot.id] ?? slot.planned_19l}
                      onChange={e => setNewQty19(prev => ({ ...prev, [slot.id]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                      10L Qty
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={newQty10[slot.id] ?? slot.planned_10l}
                      onChange={e => setNewQty10(prev => ({ ...prev, [slot.id]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-300 bg-white"
                    />
                  </div>
                </div>
                {/* Row 3: live day total */}
                {live && (
                  <div className="text-xs text-slate-500 pt-0.5">
                    <span className="text-slate-400">Day total after move: </span>
                    <span className="font-semibold text-blue-600">{live.total19} 19L</span>
                    <span className="text-slate-300 mx-1">·</span>
                    <span className="font-semibold text-cyan-600">{live.total10} 10L</span>
                    <span className="font-semibold text-slate-600 ml-1">({live.total19 + live.total10})</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-white transition-colors">
          Close
        </button>
        <button
          onClick={handleApply}
          disabled={saving || done || Object.keys(assignments).filter(k => assignments[k]).length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {done ? <><Check size={14} /> Done!</> : saving ? 'Applying...' : 'Apply Changes'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Undo Panel
// ─────────────────────────────────────────────────────────
function UndoPanel({ holidayDate, holidayName, onClose }: {
  holidayDate: string;
  holidayName: string;
  onClose: () => void;
}) {
  const weekDates = getWeekDatesForDate(holidayDate);
  // Load all days in the week to find moved-in slots originating from the holiday
  const { slots: allWeekSlots, loading, reload } = useDailySchedule(weekDates);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [undoingAll, setUndoingAll] = useState(false);

  // Slots that were moved OUT from the holiday (on the holiday date itself)
  const movedOutSlots = allWeekSlots.filter(
    s => s.slot_date === holidayDate && (s.status === 'moved_out' || s.status === 'cancelled')
  );

  // Slots that were moved INTO other days FROM the holiday
  const movedInSlots = allWeekSlots.filter(
    s => s.slot_date !== holidayDate && s.change_type === 'moved_in' && s.original_date === holidayDate
  );

  // Cancelled slots from the holiday
  const cancelledSlots = allWeekSlots.filter(
    s => s.slot_date === holidayDate && s.status === 'cancelled'
  );

  const undoSingleMove = async (movedOutSlot: DailyScheduleWithDealer) => {
    setUndoing(movedOutSlot.id);
    // Find corresponding moved-in slot
    const movedIn = movedInSlots.find(s => s.dealer_id === movedOutSlot.dealer_id);
    if (movedIn) {
      await supabase.from('daily_schedule').delete().eq('id', movedIn.id);
    }
    // Restore original slot
    await supabase.from('daily_schedule').update({
      status: 'scheduled',
      change_type: null,
      change_note: '',
    }).eq('id', movedOutSlot.id);
    setUndoing(null);
    reload();
  };

  const undoSingleCancel = async (cancelledSlot: DailyScheduleWithDealer) => {
    setUndoing(cancelledSlot.id);
    await supabase.from('daily_schedule').update({
      status: 'scheduled',
      change_type: null,
      change_note: '',
    }).eq('id', cancelledSlot.id);
    setUndoing(null);
    reload();
  };

  const undoAll = async () => {
    setUndoingAll(true);
    // Delete all moved-in slots originating from this holiday
    for (const s of movedInSlots) {
      await supabase.from('daily_schedule').delete().eq('id', s.id);
    }
    // Restore all moved-out and cancelled slots on the holiday date
    const idsToRestore = [...movedOutSlots, ...cancelledSlots].map(s => s.id);
    if (idsToRestore.length > 0) {
      await supabase.from('daily_schedule')
        .update({ status: 'scheduled', change_type: null, change_note: '' })
        .in('id', idsToRestore);
    }
    setUndoingAll(false);
    reload();
  };

  if (loading) return <div className="px-4 pb-4 text-sm text-slate-400">Loading...</div>;

  const hasChanges = movedOutSlots.length > 0 || cancelledSlots.length > 0;

  if (!hasChanges) {
    return (
      <div className="border-t border-slate-100 bg-slate-50 p-4 text-center text-sm text-slate-500">
        No redistribution has been applied for this holiday yet.
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-orange-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Undo2 size={14} className="text-orange-500" />
          <span className="text-sm font-semibold text-slate-700">Undo {holidayName} Redistribution</span>
        </div>
        {(movedOutSlots.length + cancelledSlots.length) > 1 && (
          <button
            onClick={undoAll}
            disabled={undoingAll}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline disabled:opacity-50"
          >
            {undoingAll ? 'Undoing all...' : 'Undo All'}
          </button>
        )}
      </div>

      {/* Moved slots */}
      {movedOutSlots.map(slot => {
        const destination = movedInSlots.find(s => s.dealer_id === slot.dealer_id);
        return (
          <div key={slot.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-orange-200">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-800 truncate">{slot.dealer.name}</div>
              <div className="text-xs text-slate-500">
                {slot.status === 'cancelled' ? (
                  <span className="text-red-500">Cancelled</span>
                ) : destination ? (
                  <span>
                    Moved to <span className="font-medium">{DAY_NAMES[getDayOfWeek(destination.slot_date)]}</span>
                    {' '}at {formatTime(destination.scheduled_time)}
                  </span>
                ) : (
                  <span className="text-amber-600">Moved (destination not found)</span>
                )}
              </div>
            </div>
            <button
              onClick={() => slot.status === 'cancelled' ? undoSingleCancel(slot) : undoSingleMove(slot)}
              disabled={undoing === slot.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <Undo2 size={12} />
              {undoing === slot.id ? '...' : 'Undo'}
            </button>
          </div>
        );
      })}

      <button onClick={onClose} className="w-full py-2.5 border border-orange-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-white transition-colors">
        Close
      </button>
    </div>
  );
}

// Helper: get the Mon–Sat week dates for any given date
function getWeekDatesForDate(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const dates: string[] = [];
  for (let i = 0; i < 6; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(day.toISOString().split('T')[0]);
  }
  return dates;
}
