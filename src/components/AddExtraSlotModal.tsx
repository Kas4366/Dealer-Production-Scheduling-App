import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDealers } from '../hooks/useData';
import { formatDate } from '../lib/utils';
import TimeInput from './TimeInput';

interface Props {
  date: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddExtraSlotModal({ date, onClose, onAdded }: Props) {
  const { dealers } = useDealers();
  const [dealerId, setDealerId] = useState('');
  const [time, setTime] = useState('08:00');
  const [qty19l, setQty19l] = useState('0');
  const [qty10l, setQty10l] = useState('0');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!dealerId) return;
    setSaving(true);
    await supabase.from('daily_schedule').insert({
      slot_date: date,
      dealer_id: dealerId,
      scheduled_time: time,
      planned_19l: parseInt(qty19l) || 0,
      planned_10l: parseInt(qty10l) || 0,
      status: 'scheduled',
      change_type: 'extra',
      change_note: note || 'Extra slot added manually',
      template_slot_id: null,
    });
    setSaving(false);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Add Extra Slot</h2>
            <p className="text-xs text-slate-500 mt-0.5">{formatDate(date)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Dealer *</label>
            <select
              value={dealerId}
              onChange={e => setDealerId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            >
              <option value="">Select a dealer...</option>
              {dealers.filter(d => d.active).map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Scheduled Time</label>
            <TimeInput value={time} onChange={setTime} className="w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block mr-1" />
                19L Qty
              </label>
              <input
                type="number"
                min="0"
                value={qty19l}
                onChange={e => setQty19l(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block mr-1" />
                10L Qty
              </label>
              <input
                type="number"
                min="0"
                value={qty10l}
                onChange={e => setQty10l(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Reason / Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Emergency top-up"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dealerId}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Plus size={15} />
              {saving ? 'Adding...' : 'Add Slot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
