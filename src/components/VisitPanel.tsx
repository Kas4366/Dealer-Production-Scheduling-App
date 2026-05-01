import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle, Zap, Save, CloudOff, Cloud, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DailyScheduleWithDealer, VisitStatus } from '../lib/database.types';
import { getDealerColor, formatTime, getCurrentTimeStr, formatFillDuration } from '../lib/utils';

interface Props {
  slot: DailyScheduleWithDealer;
  fillSpeed: number;
  onClose: () => void;
  onSaved: () => void;
}

type SyncState = 'idle' | 'synced' | 'failed';

export default function VisitPanel({ slot, fillSpeed, onClose, onSaved }: Props) {
  const color = getDealerColor(slot.dealer_id);
  const existing = slot.visit_record;

  const [status, setStatus] = useState<VisitStatus>(existing?.status ?? 'pending');
  const [arrivalTime, setArrivalTime] = useState(existing?.actual_arrival_time ?? '');
  const [in19l, setIn19l] = useState(String(existing?.bottles_19l_in ?? slot.planned_19l));
  const [out19l, setOut19l] = useState(String(existing?.bottles_19l_out ?? 0));
  const [in10l, setIn10l] = useState(String(existing?.bottles_10l_in ?? slot.planned_10l));
  const [out10l, setOut10l] = useState(String(existing?.bottles_10l_out ?? 0));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [recordedBy, setRecordedBy] = useState(existing?.recorded_by ?? '');
  const [saving, setSaving] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleStatusTap = (s: VisitStatus) => {
    setStatus(s);
    if (s === 'arrived' && !arrivalTime) {
      setArrivalTime(getCurrentTimeStr());
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSyncState('idle');
    const payload = {
      daily_schedule_id: slot.id,
      slot_date: slot.slot_date,
      dealer_id: slot.dealer_id,
      status,
      actual_arrival_time: arrivalTime || null,
      bottles_19l_in: parseInt(in19l) || 0,
      bottles_19l_out: parseInt(out19l) || 0,
      bottles_10l_in: parseInt(in10l) || 0,
      bottles_10l_out: parseInt(out10l) || 0,
      notes,
      recorded_by: recordedBy,
      synced_to_sheets: false,
      updated_at: new Date().toISOString(),
    };

    let savedId: string | null = existing?.id ?? null;
    if (existing?.id) {
      await supabase.from('visit_records').update(payload).eq('id', existing.id);
    } else {
      const { data: inserted } = await supabase
        .from('visit_records')
        .insert(payload)
        .select('id')
        .maybeSingle();
      savedId = inserted?.id ?? null;
    }

    // Auto-sync only this specific record to Google Sheets
    const endpointUrl = localStorage.getItem('sheets_url');
    const sheetId = localStorage.getItem('sheets_id');
    if (endpointUrl && sheetId && savedId) {
      try {
        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ sheet_id: sheetId, record_ids: [savedId] }),
        });
        setSyncState(res.ok ? 'synced' : 'failed');
      } catch {
        setSyncState('failed');
      }
    }

    setSaving(false);
    onSaved();
  };

  const statusButtons: { value: VisitStatus; label: string; icon: React.ElementType; color: string; active: string }[] = [
    { value: 'arrived', label: 'Arrived', icon: Zap, color: 'text-amber-600', active: 'bg-amber-500 text-white border-amber-500' },
    { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', active: 'bg-emerald-500 text-white border-emerald-500' },
    { value: 'no_show', label: 'No Show', icon: XCircle, color: 'text-red-600', active: 'bg-red-500 text-white border-red-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-lg ${color.light}`}>
              <span className={`text-sm font-bold ${color.text}`}>{slot.dealer.code}</span>
            </div>
            <div>
              <div className="font-bold text-slate-800">{slot.dealer.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Clock size={11} />
                {formatTime(slot.scheduled_time)}
                {slot.planned_19l > 0 && <span className="ml-2">19L: {slot.planned_19l}</span>}
                {slot.planned_10l > 0 && <span className="ml-1">10L: {slot.planned_10l}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Production time estimate */}
          {fillSpeed > 0 && (slot.planned_19l + slot.planned_10l) > 0 && (() => {
            const total = slot.planned_19l + slot.planned_10l;
            const totalMins = Math.round((total / fillSpeed) * 60);
            const duration = formatFillDuration(total, fillSpeed);
            return (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Timer size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Estimated Production Time</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-800">~{duration}</span>
                  <span className="text-xs text-slate-500">@ {fillSpeed} bottles/hr</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {slot.planned_19l > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                      19L × {slot.planned_19l} = ~{Math.round((slot.planned_19l / fillSpeed) * 60)} min
                    </span>
                  )}
                  {slot.planned_10l > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                      10L × {slot.planned_10l} = ~{Math.round((slot.planned_10l / fillSpeed) * 60)} min
                    </span>
                  )}
                  {slot.planned_19l > 0 && slot.planned_10l > 0 && (
                    <span className="text-slate-400">Total: {totalMins} min</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Status buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {statusButtons.map(({ value, label, icon: Icon, color: c, active }) => (
                <button
                  key={value}
                  onClick={() => handleStatusTap(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                    status === value ? active : `border-slate-200 ${c} hover:border-current`
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Arrival time */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Actual Arrival Time</label>
            <input
              type="time"
              value={arrivalTime}
              onChange={e => setArrivalTime(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>

          {/* Bottle counts - 19L */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />
              19L Bottles
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bottles In (Empty)</label>
                <input
                  type="number"
                  min="0"
                  value={in19l}
                  onChange={e => setIn19l(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bottles Out (Filled)</label>
                <input
                  type="number"
                  min="0"
                  value={out19l}
                  onChange={e => setOut19l(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Bottle counts - 10L */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />
              10L Bottles
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bottles In (Empty)</label>
                <input
                  type="number"
                  min="0"
                  value={in10l}
                  onChange={e => setIn10l(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bottles Out (Filled)</label>
                <input
                  type="number"
                  min="0"
                  value={out10l}
                  onChange={e => setOut10l(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Recorded by */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Recorded By</label>
            <input
              type="text"
              placeholder="Your name"
              value={recordedBy}
              onChange={e => setRecordedBy(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Notes</label>
            <textarea
              placeholder="Any observations..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none"
            />
          </div>

          {/* Save */}
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Record'}
            </button>
            {syncState === 'synced' && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600">
                <Cloud size={13} />
                Synced to Google Sheets
              </div>
            )}
            {syncState === 'failed' && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <CloudOff size={13} />
                Sheets sync pending — use Sync Sheets in Reports
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
