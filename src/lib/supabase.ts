import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Dealer = {
  id: string;
  name: string;
  code: string;
  max_19l: number;
  max_10l: number;
  active: boolean;
  contact: string;
  color: string;
  created_at: string;
};

export type WeeklyTemplate = {
  id: string;
  dealer_id: string;
  day_of_week: number;
  scheduled_time: string;
  planned_19l: number;
  planned_10l: number;
  sort_order: number;
  created_at: string;
  dealer?: Dealer;
};

export type DailySchedule = {
  id: string;
  slot_date: string;
  dealer_id: string;
  scheduled_time: string;
  planned_19l: number;
  planned_10l: number;
  status: 'scheduled' | 'moved_out' | 'cancelled' | 'extra';
  change_type: 'moved_in' | 'moved_out' | 'swapped' | 'cancelled' | 'extra' | null;
  original_date: string | null;
  swapped_with_dealer_id: string | null;
  change_note: string;
  template_slot_id: string | null;
  created_at: string;
  dealer?: Dealer;
  swapped_with_dealer?: Dealer;
};

export type VisitRecord = {
  id: string;
  daily_schedule_id: string;
  slot_date: string;
  dealer_id: string;
  status: 'pending' | 'arrived' | 'completed' | 'no_show';
  actual_arrival_time: string | null;
  bottles_19l_in: number;
  bottles_19l_out: number;
  bottles_10l_in: number;
  bottles_10l_out: number;
  notes: string;
  recorded_by: string;
  synced_to_sheets: boolean;
  created_at: string;
  updated_at: string;
  dealer?: Dealer;
  daily_schedule?: DailySchedule;
};

export type ProductionSettings = {
  id: number;
  fill_speed_per_hour: number;
  morning_break_start: string;
  morning_break_duration: number;
  lunch_break_start: string;
  lunch_break_duration: number;
  day_start: string;
  day_end: string;
  updated_at: string;
  daily_capacity_override: number | null;
  sheets_id: string | null;
  sheets_url: string | null;
};

export type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  created_at: string;
};

export type SlotRedistributionLog = {
  id: string;
  holiday_date: string;
  action: 'redistribute' | 'undo';
  affected_slot_ids: string[];
  slot_snapshot: DailySchedule[];
  created_at: string;
};

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 16 distinct dealer colors (no purple/indigo)
export const DEALER_COLORS = [
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#ec4899', // pink
  '#a3e635', // yellow-green
  '#fb923c', // light orange
  '#22d3ee', // light cyan
  '#4ade80', // light green
  '#fbbf24', // yellow
  '#f87171', // light red
];

export function getDealerColor(dealer: Dealer): string {
  return dealer.color || '#94a3b8';
}

export function getDealerBg(color: string, opacity = 0.08): string {
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function calcDailyCapacity(settings: ProductionSettings): number {
  if (settings.daily_capacity_override) return settings.daily_capacity_override;
  const start = timeToMinutes(settings.day_start);
  const end = timeToMinutes(settings.day_end);
  const morningBreak = settings.morning_break_duration;
  const lunchBreak = settings.lunch_break_duration;
  const workMinutes = end - start - morningBreak - lunchBreak;
  return Math.floor((workMinutes / 60) * settings.fill_speed_per_hour);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
