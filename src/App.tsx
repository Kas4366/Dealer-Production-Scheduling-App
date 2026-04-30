import React, { useState } from 'react';
import Layout, { type Page } from './components/Layout';
import DailyView from './components/DailyView';
import WeeklyView from './components/WeeklyView';
import HolidaysView from './components/HolidaysView';
import DealersView from './components/DealersView';
import SettingsView from './components/SettingsView';
import ReportsView from './components/ReportsView';
import { useKeepAlive } from './hooks/useData';

export default function App() {
  const [page, setPage] = useState<Page>('daily');
  useKeepAlive();

  return (
    <Layout page={page} onNavigate={setPage}>
      {page === 'daily' && <DailyView />}
      {page === 'weekly' && <WeeklyView />}
      {page === 'holidays' && <HolidaysView />}
      {page === 'reports' && <ReportsView />}
      {page === 'dealers' && <DealersView />}
      {page === 'settings' && <SettingsView />}
    </Layout>
  );
}
