import React, { useState, useEffect } from 'react';
import { Save, Zap, Coffee, Clock, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductionSettings } from '../hooks/useData';
import { calculateCapacity } from '../lib/utils';

export default function SettingsView() {
  const { settings, reload } = useProductionSettings();
  const [speed, setSpeed] = useState('300');
  const [dayStart, setDayStart] = useState('07:30');
  const [dayEnd, setDayEnd] = useState('17:00');
  const [morningBreakStart, setMorningBreakStart] = useState('10:00');
  const [morningBreakDuration, setMorningBreakDuration] = useState('15');
  const [lunchBreakStart, setLunchBreakStart] = useState('12:30');
  const [lunchBreakDuration, setLunchBreakDuration] = useState('30');

  // Capacity override
  const [useManualCapacity, setUseManualCapacity] = useState(false);
  const [manualCapacity, setManualCapacity] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [sheetsUrl, setSheetsUrl] = useState(() => localStorage.getItem('sheets_url') ?? '');
  const [sheetsId, setSheetsId] = useState(() => localStorage.getItem('sheets_id') ?? '');
  const [sheetsSaving, setSheetsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setSpeed(String(settings.fill_speed_per_hour));
      setDayStart(settings.day_start);
      setDayEnd(settings.day_end);
      setMorningBreakStart(settings.morning_break_start);
      setMorningBreakDuration(String(settings.morning_break_duration));
      setLunchBreakStart(settings.lunch_break_start);
      setLunchBreakDuration(String(settings.lunch_break_duration));
      if (settings.daily_capacity_override != null && settings.daily_capacity_override > 0) {
        setUseManualCapacity(true);
        setManualCapacity(String(settings.daily_capacity_override));
      } else {
        setUseManualCapacity(false);
        setManualCapacity('');
      }
    }
  }, [settings]);

  const autoCapacity = calculateCapacity({
    fill_speed_per_hour: parseInt(speed) || 300,
    morning_break_start: morningBreakStart,
    morning_break_duration: parseInt(morningBreakDuration) || 15,
    lunch_break_start: lunchBreakStart,
    lunch_break_duration: parseInt(lunchBreakDuration) || 30,
    day_start: dayStart,
    day_end: dayEnd,
  });

  const effectiveCapacity = useManualCapacity && parseInt(manualCapacity) > 0
    ? parseInt(manualCapacity)
    : autoCapacity;

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('production_settings').update({
      fill_speed_per_hour: parseInt(speed) || 300,
      day_start: dayStart,
      day_end: dayEnd,
      morning_break_start: morningBreakStart,
      morning_break_duration: parseInt(morningBreakDuration) || 15,
      lunch_break_start: lunchBreakStart,
      lunch_break_duration: parseInt(lunchBreakDuration) || 30,
      daily_capacity_override: useManualCapacity && parseInt(manualCapacity) > 0
        ? parseInt(manualCapacity)
        : null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    reload();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveSheets = () => {
    localStorage.setItem('sheets_url', sheetsUrl);
    localStorage.setItem('sheets_id', sheetsId);
    setSheetsSaving(true);
    setTimeout(() => setSheetsSaving(false), 1000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Production Settings</h1>
        <p className="text-sm text-slate-500">Configure daily capacity, working hours and breaks</p>
      </div>

      {/* Daily Capacity */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-blue-500" />
          <span className="font-semibold text-slate-800">Daily Capacity</span>
        </div>

        {/* Toggle: auto vs manual */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <div>
            <div className="text-sm font-medium text-slate-700">Manual capacity limit</div>
            <div className="text-xs text-slate-500 mt-0.5">Override the auto-calculated value</div>
          </div>
          <button
            onClick={() => {
              setUseManualCapacity(!useManualCapacity);
              if (!useManualCapacity && !manualCapacity) setManualCapacity(String(autoCapacity));
            }}
            className={`transition-colors ${useManualCapacity ? 'text-blue-600' : 'text-slate-400'}`}
          >
            {useManualCapacity ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>

        {useManualCapacity ? (
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Daily capacity (bottles)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={manualCapacity}
                onChange={e => setManualCapacity(e.target.value)}
                placeholder="e.g. 1500"
                className="w-40 border border-blue-300 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-sm text-slate-500">bottles / day</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Auto-calculated would be {autoCapacity} bottles. Manual value overrides this.
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Fill speed (bottles per hour)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                className="w-32 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-sm text-slate-500">bottles / hour</span>
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-3">
          <div className="text-xs text-blue-500 mb-1">
            Effective daily capacity {useManualCapacity ? '(manual)' : '(auto-calculated)'}
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {effectiveCapacity} <span className="text-base font-normal">bottles/day</span>
          </div>
        </div>
      </div>

      {/* Working hours */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-slate-500" />
          <span className="font-semibold text-slate-800">Working Hours</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Day Start</label>
            <input type="time" value={dayStart} onChange={e => setDayStart(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Day End</label>
            <input type="time" value={dayEnd} onChange={e => setDayEnd(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </div>

      {/* Breaks */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Coffee size={18} className="text-amber-500" />
          <span className="font-semibold text-slate-800">Break Times</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Morning Break Start</label>
            <input type="time" value={morningBreakStart} onChange={e => setMorningBreakStart(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Duration (minutes)</label>
            <input type="number" min="1" value={morningBreakDuration} onChange={e => setMorningBreakDuration(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Lunch Break Start</label>
            <input type="time" value={lunchBreakStart} onChange={e => setLunchBreakStart(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Duration (minutes)</label>
            <input type="number" min="1" value={lunchBreakDuration} onChange={e => setLunchBreakDuration(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base transition-all ${
          saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
        } disabled:opacity-60`}
      >
        <Save size={18} />
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Google Sheets config */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="font-semibold text-slate-800">Google Sheets Integration</div>
        <p className="text-sm text-slate-500">
          Enter your Google Sheet ID (found in the sheet URL) and the sync endpoint URL from your edge function.
          Records are synced automatically when visit data is saved.
        </p>
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Google Sheet ID</label>
          <input
            type="text"
            value={sheetsId}
            onChange={e => setSheetsId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Sync Endpoint URL</label>
          <input
            type="url"
            value={sheetsUrl}
            onChange={e => setSheetsUrl(e.target.value)}
            placeholder="https://...supabase.co/functions/v1/sync-sheets"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
          />
        </div>
        <button
          onClick={handleSaveSheets}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Save size={15} />
          {sheetsSaving ? 'Saved!' : 'Save Config'}
        </button>
      </div>
    </div>
  );
}
