import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Dealer,
  ProductionSettings,
  WeeklyTemplateWithDealer,
  DailyScheduleWithDealer,
  Holiday,
} from '../lib/database.types';
import { assignDealerColors } from '../lib/utils';

export function useDealers() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('dealers').select('*').order('name');
    if (data) {
      assignDealerColors(data.map(d => d.id));
      setDealers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { dealers, loading, reload: load };
}

export function useProductionSettings() {
  const [settings, setSettings] = useState<ProductionSettings | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('production_settings').select('*').eq('id', 1).maybeSingle();
    if (data) setSettings(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { settings, reload: load };
}

export function useWeeklyTemplates() {
  const [templates, setTemplates] = useState<WeeklyTemplateWithDealer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('weekly_schedule_templates')
      .select('*, dealer:dealers(*)')
      .order('day_of_week')
      .order('scheduled_time');
    if (data) setTemplates(data as WeeklyTemplateWithDealer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { templates, loading, reload: load };
}

export function useDailySchedule(dates: string[]) {
  const [slots, setSlots] = useState<DailyScheduleWithDealer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!dates.length) return;
    setLoading(true);
    const { data } = await supabase
      .from('daily_schedule')
      .select('*, dealer:dealers!daily_schedule_dealer_id_fkey(*), swapped_with_dealer:dealers!daily_schedule_swapped_with_dealer_id_fkey(*), visit_record:visit_records(*)')
      .in('slot_date', dates)
      .order('scheduled_time');
    if (data) {
      const processed = data.map((s: any) => ({
        ...s,
        visit_record: Array.isArray(s.visit_record) ? s.visit_record[0] ?? null : s.visit_record,
      }));
      setSlots(processed as DailyScheduleWithDealer[]);
    }
    setLoading(false);
  }, [dates.join(',')]);

  useEffect(() => { load(); }, [load]);
  return { slots, loading, reload: load };
}

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('holidays').select('*').order('holiday_date');
    if (data) setHolidays(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { holidays, reload: load };
}

// Keep Supabase alive (prevents free-tier pausing)
export function useKeepAlive() {
  useEffect(() => {
    const interval = setInterval(async () => {
      await supabase.from('production_settings').select('id').eq('id', 1).maybeSingle();
    }, 4 * 24 * 60 * 60 * 1000); // every 4 days
    return () => clearInterval(interval);
  }, []);
}
