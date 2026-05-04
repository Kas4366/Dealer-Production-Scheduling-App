import React, { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWeeklyTemplates } from '../hooks/useData';
import { DAY_NAMES, getDayOfWeek } from '../lib/utils';

interface Props {
  weekDates: string[];
  onClose: () => void;
  onGenerated: () => void;
}

export default function GenerateWeekModal({ weekDates, onClose, onGenerated }: Props) {
  const { templates } = useWeeklyTemplates();
  const [generating, setGenerating] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);

    for (const date of weekDates) {
      const dow = getDayOfWeek(date);
      const dayTemplates = templates.filter(t => t.day_of_week === dow);

      if (dayTemplates.length === 0) continue;

      if (overwrite) {
        // Remove template-generated slots (both still-linked ones and orphaned ones
        // whose template_slot_id was nullified when the template slot was deleted).
        // Extra/manually-added slots are identified by change_type = 'extra' and are kept.
        await supabase
          .from('daily_schedule')
          .delete()
          .eq('slot_date', date)
          .eq('status', 'scheduled')
          .is('change_type', null);
      }

      for (const t of dayTemplates) {
        // Check if slot already exists
        const { data: existing } = await supabase
          .from('daily_schedule')
          .select('id')
          .eq('slot_date', date)
          .eq('template_slot_id', t.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('daily_schedule').insert({
            slot_date: date,
            dealer_id: t.dealer_id,
            scheduled_time: t.scheduled_time,
            planned_19l: t.planned_19l,
            planned_10l: t.planned_10l,
            template_slot_id: t.id,
            status: 'scheduled',
            change_type: null,
            change_note: '',
          });
        }
      }
    }

    setGenerating(false);
    onGenerated();
    onClose();
  };

  const weekLabel = weekDates.length > 0
    ? `${new Date(weekDates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(weekDates[5] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : '';

  const totalSlots = weekDates.reduce((sum, date) => {
    const dow = getDayOfWeek(date);
    return sum + templates.filter(t => t.day_of_week === dow).length;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">Generate Week</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm font-semibold text-blue-800">{weekLabel}</div>
            <div className="text-xs text-blue-600 mt-1">{totalSlots} slots from weekly template</div>
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p>This will create daily schedule entries for the selected week based on the weekly template.</p>
            <p>Existing slots that were manually moved or cancelled will not be affected.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600"
            />
            <div>
              <div className="font-medium text-slate-700">Overwrite existing template slots</div>
              <div className="text-xs text-slate-500">Remove and re-create slots that came from the template (manual additions are kept)</div>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <Zap size={15} />
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
