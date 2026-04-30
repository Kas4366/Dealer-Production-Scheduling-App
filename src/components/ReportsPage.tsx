import { useState, useEffect } from 'react';
import { supabase, Dealer, getDealerColor, getDealerBg } from '../lib/supabase';
import { BarChart2, Table2, ChevronLeft, ChevronRight, Share2, Loader2, TrendingUp, Users, Package, CheckCircle2 } from 'lucide-react';

type RangeType = 'week' | 'month';

type DealerStats = {
  dealer: Dealer;
  totalSlots: number;
  completed: number;
  noShow: number;
  planned19l: number;
  planned10l: number;
  actual19l: number;
  actual10l: number;
  reliability: number;
};

type DailyPoint = {
  date: string;
  label: string;
  planned: number;
  actual: number;
};

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWeekBounds(ref: Date): { start: Date; end: Date } {
  const d = new Date(ref);
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setDate(d.getDate() + 5);
  return { start: d, end };
}

function getMonthBounds(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start, end };
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [range, setRange] = useState<RangeType>('week');
  const [refDate, setRefDate] = useState(new Date());
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [stats, setStats] = useState<DealerStats[]>([]);
  const [dailyPoints, setDailyPoints] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ slots: 0, completed: 0, planned: 0, actual: 0 });

  const bounds = range === 'week' ? getWeekBounds(refDate) : getMonthBounds(refDate);
  const startStr = formatDate(bounds.start);
  const endStr = formatDate(bounds.end);

  const rangeLabel = range === 'week'
    ? `${bounds.start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${bounds.end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : bounds.start.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  const navigate = (dir: number) => {
    const d = new Date(refDate);
    if (range === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setRefDate(d);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: dealerData }, { data: scheduleData }, { data: visitData }] = await Promise.all([
        supabase.from('dealers').select('*').eq('active', true).order('name'),
        supabase.from('daily_schedule')
          .select('*, dealer:dealers(*)')
          .gte('slot_date', startStr)
          .lte('slot_date', endStr)
          .neq('status', 'cancelled')
          .neq('status', 'moved_out'),
        supabase.from('visit_records')
          .select('*')
          .gte('slot_date', startStr)
          .lte('slot_date', endStr),
      ]);

      const dl = dealerData || [];
      setDealers(dl);

      const schedule = scheduleData || [];
      const visits = visitData || [];
      const visitByScheduleId = new Map(visits.map((v: { daily_schedule_id: string }) => [v.daily_schedule_id, v]));

      // Per-dealer stats
      const statsArr: DealerStats[] = dl.map((dealer: Dealer) => {
        const dealerSlots = schedule.filter((s: { dealer_id: string }) => s.dealer_id === dealer.id);
        const dealerVisits = dealerSlots.map((s: { id: string }) => visitByScheduleId.get(s.id)).filter(Boolean);

        const completed = dealerVisits.filter((v: { status: string }) => v.status === 'completed').length;
        const noShow = dealerVisits.filter((v: { status: string }) => v.status === 'no_show').length;
        const planned19l = dealerSlots.reduce((a: number, s: { planned_19l: number }) => a + s.planned_19l, 0);
        const planned10l = dealerSlots.reduce((a: number, s: { planned_10l: number }) => a + s.planned_10l, 0);
        const actual19l = dealerVisits.reduce((a: number, v: { bottles_19l_out: number }) => a + (v.bottles_19l_out || 0), 0);
        const actual10l = dealerVisits.reduce((a: number, v: { bottles_10l_out: number }) => a + (v.bottles_10l_out || 0), 0);
        const reliability = dealerSlots.length > 0 ? Math.round((completed / dealerSlots.length) * 100) : 0;

        return {
          dealer,
          totalSlots: dealerSlots.length,
          completed,
          noShow,
          planned19l,
          planned10l,
          actual19l,
          actual10l,
          reliability,
        };
      }).filter((s: DealerStats) => s.totalSlots > 0);

      setStats(statsArr);

      // Daily trend
      const days: DailyPoint[] = [];
      let cursor = new Date(bounds.start);
      while (cursor <= bounds.end) {
        const ds = formatDate(cursor);
        const daySlots = schedule.filter((s: { slot_date: string }) => s.slot_date === ds);
        const planned = daySlots.reduce((a: number, s: { planned_19l: number; planned_10l: number }) => a + s.planned_19l + s.planned_10l, 0);
        const actual = daySlots
          .map((s: { id: string }) => visitByScheduleId.get(s.id))
          .filter(Boolean)
          .filter((v: { status: string }) => v.status === 'completed')
          .reduce((a: number, v: { bottles_19l_out: number; bottles_10l_out: number }) => a + (v.bottles_19l_out || 0) + (v.bottles_10l_out || 0), 0);

        days.push({
          date: ds,
          label: cursor.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' }),
          planned,
          actual,
        });
        cursor = addDays(cursor, 1);
      }
      setDailyPoints(days);

      const allSlots = schedule.length;
      const allCompleted = visits.filter((v: { status: string }) => v.status === 'completed').length;
      const allPlanned = schedule.reduce((a: number, s: { planned_19l: number; planned_10l: number }) => a + s.planned_19l + s.planned_10l, 0);
      const allActual = visits.filter((v: { status: string }) => v.status === 'completed')
        .reduce((a: number, v: { bottles_19l_out: number; bottles_10l_out: number }) => a + (v.bottles_19l_out || 0) + (v.bottles_10l_out || 0), 0);
      setTotals({ slots: allSlots, completed: allCompleted, planned: allPlanned, actual: allActual });

      setLoading(false);
    })();
  }, [startStr, endStr]);

  const maxPlanned = Math.max(...statsArr().map(s => s.planned19l + s.planned10l), 1);
  const maxDaily = Math.max(...dailyPoints.map(d => d.planned), 1);

  function statsArr() { return stats; }

  const shareText = () => {
    const lines = [
      `IVO Production Planner — Report`,
      `${rangeLabel}`,
      ``,
      `Total Slots: ${totals.slots} | Completed: ${totals.completed} | Reliability: ${totals.slots > 0 ? Math.round((totals.completed / totals.slots) * 100) : 0}%`,
      `Planned Bottles: ${totals.planned} | Actual Filled: ${totals.actual}`,
      ``,
      ...stats.map(s => `${s.dealer.name}: ${s.totalSlots} slots, ${s.reliability}% reliability, ${s.actual19l + s.actual10l} bottles filled`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    alert('Report copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">Production summaries, dealer performance, and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={shareText} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        {/* Range type toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          {(['week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                range === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[180px] text-center">{rangeLabel}</span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setRefDate(new Date())} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Today
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'chart' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart2 size={14} />
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Table2 size={14} />
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-sky-500" />
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={<Users size={18} />} label="Total Slots" value={totals.slots} color="sky" />
            <KpiCard icon={<CheckCircle2 size={18} />} label="Completed" value={totals.completed} color="emerald"
              sub={totals.slots > 0 ? `${Math.round((totals.completed / totals.slots) * 100)}% reliability` : undefined} />
            <KpiCard icon={<Package size={18} />} label="Planned Bottles" value={totals.planned} color="blue" />
            <KpiCard icon={<TrendingUp size={18} />} label="Bottles Filled" value={totals.actual} color="teal"
              sub={totals.planned > 0 ? `${Math.round((totals.actual / totals.planned) * 100)}% of plan` : undefined} />
          </div>

          {viewMode === 'chart' ? (
            <div className="space-y-5">
              {/* Daily trend chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Daily Bottles — Planned vs Actual</h3>
                {dailyPoints.every(d => d.planned === 0) ? (
                  <p className="text-slate-400 text-sm py-8 text-center">No data for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-2 min-w-fit" style={{ height: 180 }}>
                      {dailyPoints.map(point => {
                        const plannedPct = (point.planned / maxDaily) * 100;
                        const actualPct = (point.actual / maxDaily) * 100;
                        return (
                          <div key={point.date} className="flex flex-col items-center gap-1 min-w-[48px]">
                            <div className="flex items-end gap-0.5" style={{ height: 150 }}>
                              <div className="relative w-5 rounded-t-sm bg-sky-100 flex items-end justify-center"
                                style={{ height: `${Math.max(4, plannedPct)}%` }}>
                                <div className="absolute bottom-0 w-full rounded-t-sm bg-sky-400"
                                  style={{ height: `${actualPct > 0 ? Math.min(100, (actualPct / plannedPct) * 100) : 0}%` }} />
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 text-center leading-tight">{point.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-sky-100 border border-sky-300" />
                        <span className="text-xs text-slate-500">Planned</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-sky-400" />
                        <span className="text-xs text-slate-500">Actual</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Per-dealer bar chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Bottles per Dealer</h3>
                {stats.length === 0 ? (
                  <p className="text-slate-400 text-sm py-8 text-center">No data for this period</p>
                ) : (
                  <div className="space-y-3">
                    {stats.sort((a, b) => (b.planned19l + b.planned10l) - (a.planned19l + a.planned10l)).map(s => {
                      const color = getDealerColor(s.dealer);
                      const bg = getDealerBg(color, 0.12);
                      const total = s.planned19l + s.planned10l;
                      const actual = s.actual19l + s.actual10l;
                      const pct = total > 0 ? (actual / total) * 100 : 0;
                      const widthPct = (total / maxPlanned) * 100;

                      return (
                        <div key={s.dealer.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                              <span className="text-sm font-medium text-slate-800">{s.dealer.name}</span>
                              <span className="text-xs text-slate-400 font-mono">{s.dealer.code}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500">{actual} / {total} bottles</span>
                              <span className="text-xs font-semibold"
                                style={{ color }}>
                                {s.reliability}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="h-full rounded-full flex items-center" style={{ width: `${widthPct}%`, background: bg }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reliability chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Dealer Reliability Score</h3>
                {stats.length === 0 ? (
                  <p className="text-slate-400 text-sm py-8 text-center">No data for this period</p>
                ) : (
                  <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ height: 160 }}>
                    {stats.sort((a, b) => b.reliability - a.reliability).map(s => {
                      const color = getDealerColor(s.dealer);
                      return (
                        <div key={s.dealer.id} className="flex flex-col items-center gap-1 min-w-[52px]" style={{ height: 150 }}>
                          <span className="text-xs font-bold" style={{ color }}>{s.reliability}%</span>
                          <div className="flex-1 w-8 flex items-end">
                            <div
                              className="w-full rounded-t-lg transition-all"
                              style={{
                                height: `${Math.max(4, s.reliability)}%`,
                                background: color,
                                opacity: 0.85,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 text-center leading-tight">{s.dealer.code}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Table view */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {stats.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-slate-400">No data for this period</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dealer</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Slots</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Completed</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">No Show</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Planned 19L</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Planned 10L</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actual 19L</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actual 10L</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reliability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.sort((a, b) => b.reliability - a.reliability).map(s => {
                        const color = getDealerColor(s.dealer);
                        return (
                          <tr key={s.dealer.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                                <div>
                                  <div className="font-semibold text-slate-900 text-sm">{s.dealer.name}</div>
                                  <div className="text-xs text-slate-400 font-mono">{s.dealer.code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700">{s.totalSlots}</td>
                            <td className="px-4 py-3 text-right text-sm text-emerald-600 font-medium">{s.completed}</td>
                            <td className="px-4 py-3 text-right text-sm text-red-500">{s.noShow}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-600">{s.planned19l.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-600">{s.planned10l.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700 font-medium">{s.actual19l.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700 font-medium">{s.actual10l.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${s.reliability}%`, background: color }} />
                                </div>
                                <span className="text-sm font-bold min-w-[36px] text-right" style={{ color }}>
                                  {s.reliability}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Totals</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">{totals.slots}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">{totals.completed}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-500">
                          {stats.reduce((a, s) => a + s.noShow, 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                          {stats.reduce((a, s) => a + s.planned19l, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                          {stats.reduce((a, s) => a + s.planned10l, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                          {stats.reduce((a, s) => a + s.actual19l, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                          {stats.reduce((a, s) => a + s.actual10l, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                          {totals.slots > 0 ? `${Math.round((totals.completed / totals.slots) * 100)}%` : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  sub?: string;
}) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 opacity-70 mb-1">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}
