import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Users, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDealers } from '../hooks/useData';
import { formatDate, getWeekDates, DAY_NAMES, getDayOfWeek } from '../lib/utils';

interface DealerStats {
  dealer_id: string;
  dealer_name: string;
  dealer_code: string;
  slots_scheduled: number;
  slots_completed: number;
  slots_no_show: number;
  total_19l: number;
  total_10l: number;
  total_home: number;
  total_bottles: number;
}

interface DaySummary {
  date: string;
  total_filled: number;
  total_planned: number;
  filled_19l: number;
  filled_10l: number;
  filled_home: number;
  planned_19l: number;
  planned_10l: number;
}

export default function ReportsView() {
  const { dealers } = useDealers();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dealerStats, setDealerStats] = useState<DealerStats[]>([]);
  const [dayStats, setDayStats] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = weekDates.length > 0
    ? `${new Date(weekDates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(weekDates[5] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : '';

  useEffect(() => {
    loadStats();
  }, [weekOffset, dealers]);

  const loadStats = async () => {
    if (!dealers.length) return;
    setLoading(true);

    // Load all daily schedule slots and visit records for the week
    const { data: schedules } = await supabase
      .from('daily_schedule')
      .select('*, visit_record:visit_records(*)')
      .in('slot_date', weekDates)
      .neq('status', 'moved_out')
      .neq('status', 'cancelled');

    const stats: Record<string, DealerStats> = {};
    const dayMap: Record<string, DaySummary> = {};

    weekDates.forEach(d => {
      dayMap[d] = { date: d, total_filled: 0, total_planned: 0, filled_19l: 0, filled_10l: 0, filled_home: 0, planned_19l: 0, planned_10l: 0 };
    });

    for (const s of (schedules ?? [])) {
      const d = dealers.find(dl => dl.id === s.dealer_id);
      if (!d) continue;

      if (!stats[s.dealer_id]) {
        stats[s.dealer_id] = {
          dealer_id: s.dealer_id,
          dealer_name: d.name,
          dealer_code: d.code,
          slots_scheduled: 0,
          slots_completed: 0,
          slots_no_show: 0,
          total_19l: 0,
          total_10l: 0,
          total_home: 0,
          total_bottles: 0,
        };
      }

      stats[s.dealer_id].slots_scheduled++;
      dayMap[s.slot_date].total_planned += s.planned_19l + s.planned_10l;
      dayMap[s.slot_date].planned_19l += s.planned_19l;
      dayMap[s.slot_date].planned_10l += s.planned_10l;

      const vr = Array.isArray(s.visit_record) ? s.visit_record[0] : s.visit_record;
      if (vr) {
        if (vr.status === 'completed') {
          stats[s.dealer_id].slots_completed++;
          stats[s.dealer_id].total_19l += vr.bottles_19l_out || 0;
          stats[s.dealer_id].total_10l += vr.bottles_10l_out || 0;
          stats[s.dealer_id].total_home += vr.bottles_home || 0;
          stats[s.dealer_id].total_bottles += (vr.bottles_19l_out || 0) + (vr.bottles_10l_out || 0) + (vr.bottles_home || 0);
          dayMap[s.slot_date].total_filled += (vr.bottles_19l_out || 0) + (vr.bottles_10l_out || 0) + (vr.bottles_home || 0);
          dayMap[s.slot_date].filled_19l += vr.bottles_19l_out || 0;
          dayMap[s.slot_date].filled_10l += vr.bottles_10l_out || 0;
          dayMap[s.slot_date].filled_home += vr.bottles_home || 0;
        } else if (vr.status === 'no_show') {
          stats[s.dealer_id].slots_no_show++;
        }
      }
    }

    setDealerStats(Object.values(stats).sort((a, b) => b.total_bottles - a.total_bottles));
    setDayStats(weekDates.map(d => dayMap[d]));
    setLoading(false);
  };

  const handleSyncSheets = async () => {
    const endpointUrl = localStorage.getItem('sheets_url');
    const sheetId = localStorage.getItem('sheets_id');
    if (!endpointUrl || !sheetId) {
      setSyncMsg('Configure Google Sheets settings first.');
      setTimeout(() => setSyncMsg(''), 3000);
      return;
    }
    setSyncingSheets(true);
    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ sheet_id: sheetId, week_dates: weekDates }),
      });
      if (res.ok) setSyncMsg('Synced to Google Sheets!');
      else setSyncMsg('Sync failed. Check your configuration.');
    } catch {
      setSyncMsg('Could not reach sync endpoint.');
    }
    setSyncingSheets(false);
    setTimeout(() => setSyncMsg(''), 4000);
  };

  const totalFilled = dayStats.reduce((sum, d) => sum + d.total_filled, 0);
  const totalPlanned = dayStats.reduce((sum, d) => sum + d.total_planned, 0);
  const totalFilled19 = dayStats.reduce((sum, d) => sum + d.filled_19l, 0);
  const totalFilled10 = dayStats.reduce((sum, d) => sum + d.filled_10l, 0);
  const totalFilledHome = dayStats.reduce((sum, d) => sum + d.filled_home, 0);
  const totalPlanned19 = dayStats.reduce((sum, d) => sum + d.planned_19l, 0);
  const totalPlanned10 = dayStats.reduce((sum, d) => sum + d.planned_10l, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500">{weekLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncSheets}
            disabled={syncingSheets}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={13} className={syncingSheets ? 'animate-spin' : ''} />
            Sync Sheets
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${syncMsg.includes('Synced') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {syncMsg}
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">←</button>
        <span className="text-sm font-medium text-slate-700">{weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekLabel}</span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">→</button>
      </div>

      {/* Weekly totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-2 font-medium">Filled</div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-bold text-blue-600">{totalFilled19} <span className="text-xs font-normal text-slate-400">19L</span></div>
              <div className="text-lg font-bold text-cyan-600">{totalFilled10} <span className="text-xs font-normal text-slate-400">10L</span></div>
              {totalFilledHome > 0 && (
                <div className="text-lg font-bold text-emerald-500">{totalFilledHome} <span className="text-xs font-normal text-slate-400">Home</span></div>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-800">{totalFilled}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-2 font-medium">Planned</div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-bold text-blue-400">{totalPlanned19} <span className="text-xs font-normal text-slate-400">19L</span></div>
              <div className="text-lg font-bold text-cyan-400">{totalPlanned10} <span className="text-xs font-normal text-slate-400">10L</span></div>
            </div>
            <div className="text-2xl font-bold text-slate-700">{totalPlanned}</div>
          </div>
        </div>
      </div>

      {/* Daily breakdown bars */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700 mb-4">Daily Production</div>
        <div className="space-y-3">
          {dayStats.map(day => {
            const pct = day.total_planned > 0 ? (day.total_filled / day.total_planned) * 100 : 0;
            return (
              <div key={day.date}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">{DAY_NAMES[getDayOfWeek(day.date)]}</span>
                  <span className="text-slate-500">
                    <span className="text-blue-600">{day.filled_19l}</span>/<span className="text-slate-400">{day.planned_19l}</span>
                    <span className="text-slate-300 mx-1">19L</span>
                    <span className="text-cyan-600">{day.filled_10l}</span>/<span className="text-slate-400">{day.planned_10l}</span>
                    <span className="text-slate-300 ml-1">10L</span>
                    {day.filled_home > 0 && (
                      <>
                        <span className="text-slate-300 mx-1">·</span>
                        <span className="text-emerald-500">{day.filled_home} Home</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dealer stats */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="text-sm font-semibold text-slate-700">Dealer Performance</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : dealerStats.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No data for this week</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dealerStats.map(ds => {
              const reliability = ds.slots_scheduled > 0
                ? Math.round((ds.slots_completed / ds.slots_scheduled) * 100)
                : 0;
              return (
                <div key={ds.dealer_id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{ds.dealer_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span>{ds.slots_completed}/{ds.slots_scheduled} slots</span>
                        {ds.slots_no_show > 0 && <span className="text-red-500 ml-2">{ds.slots_no_show} no-show</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-800">{ds.total_bottles}</div>
                      <div className="text-xs text-slate-500">bottles</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs">
                    {ds.total_19l > 0 && <span className="text-blue-600">19L: {ds.total_19l}</span>}
                    {ds.total_10l > 0 && <span className="text-cyan-600">10L: {ds.total_10l}</span>}
                    {ds.total_home > 0 && <span className="text-emerald-500">Home: {ds.total_home}</span>}
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${reliability >= 80 ? 'bg-emerald-500' : reliability >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${reliability}%` }}
                        />
                      </div>
                      <span className={`font-medium ${reliability >= 80 ? 'text-emerald-600' : reliability >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {reliability}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
