import React from 'react';
import { Droplets, Calendar, ClipboardList, Settings, BarChart2, Users, Sun } from 'lucide-react';

export type Page = 'daily' | 'weekly' | 'holidays' | 'dealers' | 'settings' | 'reports';

interface LayoutProps {
  page: Page;
  onNavigate: (p: Page) => void;
  children: React.ReactNode;
}

const NAV = [
  { id: 'daily' as Page, label: 'Daily', icon: ClipboardList },
  { id: 'weekly' as Page, label: 'Weekly', icon: Calendar },
  { id: 'holidays' as Page, label: 'Holidays', icon: Sun },
  { id: 'reports' as Page, label: 'Reports', icon: BarChart2 },
  { id: 'dealers' as Page, label: 'Dealers', icon: Users },
  { id: 'settings' as Page, label: 'Settings', icon: Settings },
];

export default function Layout({ page, onNavigate, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Droplets size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 leading-tight">AquaTrack</div>
              <div className="text-xs text-slate-500 leading-tight hidden sm:block">Water Filling Schedule</div>
            </div>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  page === id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40">
        <div className="grid grid-cols-6 h-16">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                page === id ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
