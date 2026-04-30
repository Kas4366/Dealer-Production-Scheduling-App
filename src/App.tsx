import { useState, useEffect } from 'react';
import { Calendar, CalendarDays, Users, LayoutGrid, Settings, Droplets, BarChart2 } from 'lucide-react';
import DailyView from './components/DailyView';
import WeeklySchedule from './components/WeeklySchedule';
import DealerManagement from './components/DealerManagement';
import TemplateSchedule from './components/TemplateSchedule';
import SettingsPage from './components/SettingsPage';
import ReportsPage from './components/ReportsPage';
import { supabase, DEALER_COLORS } from './lib/supabase';

type Tab = 'daily' | 'weekly' | 'dealers' | 'templates' | 'settings' | 'reports';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'daily', label: 'Daily', icon: <Calendar size={18} /> },
  { id: 'weekly', label: 'Weekly', icon: <CalendarDays size={18} /> },
  { id: 'dealers', label: 'Dealers', icon: <Users size={18} /> },
  { id: 'templates', label: 'Templates', icon: <LayoutGrid size={18} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart2 size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');

  // Auto-assign colors to dealers that don't have one
  useEffect(() => {
    (async () => {
      const { data: dealers } = await supabase
        .from('dealers')
        .select('id, color')
        .order('created_at');
      if (!dealers) return;
      const updates = dealers
        .filter(d => !d.color)
        .map((d, i) => ({
          id: d.id,
          color: DEALER_COLORS[i % DEALER_COLORS.length],
        }));
      for (const u of updates) {
        await supabase.from('dealers').update({ color: u.color }).eq('id', u.id);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-md">
                <Droplets size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight tracking-tight">IVO Production Planner</h1>
                <p className="text-xs text-slate-400 leading-tight">Water Bottle Filling Schedule</p>
              </div>
            </div>
            <nav className="hidden sm:flex items-center gap-0.5">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-sky-50 text-sky-700 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden bg-white border-b border-slate-200 flex overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-sky-700 border-b-2 border-sky-600'
                : 'text-slate-500'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {activeTab === 'daily' && <DailyView />}
        {activeTab === 'weekly' && <WeeklySchedule />}
        {activeTab === 'dealers' && <DealerManagement />}
        {activeTab === 'templates' && <TemplateSchedule />}
        {activeTab === 'reports' && <ReportsPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
