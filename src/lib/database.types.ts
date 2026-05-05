export interface Database {
  public: {
    Tables: {
      dealers: {
        Row: Dealer;
        Insert: Omit<Dealer, 'id' | 'created_at'>;
        Update: Partial<Omit<Dealer, 'id' | 'created_at'>>;
      };
      production_settings: {
        Row: ProductionSettings;
        Insert: Omit<ProductionSettings, 'updated_at'>;
        Update: Partial<Omit<ProductionSettings, 'id'>>;
      };
      weekly_schedule_templates: {
        Row: WeeklyScheduleTemplate;
        Insert: Omit<WeeklyScheduleTemplate, 'id' | 'created_at'>;
        Update: Partial<Omit<WeeklyScheduleTemplate, 'id' | 'created_at'>>;
      };
      daily_schedule: {
        Row: DailySchedule;
        Insert: Omit<DailySchedule, 'id' | 'created_at'>;
        Update: Partial<Omit<DailySchedule, 'id' | 'created_at'>>;
      };
      visit_records: {
        Row: VisitRecord;
        Insert: Omit<VisitRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VisitRecord, 'id' | 'created_at'>>;
      };
      holidays: {
        Row: Holiday;
        Insert: Omit<Holiday, 'id' | 'created_at'>;
        Update: Partial<Omit<Holiday, 'id' | 'created_at'>>;
      };
    };
  };
}

export interface Dealer {
  id: string;
  name: string;
  code: string;
  max_19l: number;
  max_10l: number;
  active: boolean;
  contact: string;
  created_at: string;
}

export interface ProductionSettings {
  id: number;
  fill_speed_per_hour: number;
  morning_break_start: string;
  morning_break_duration: number;
  lunch_break_start: string;
  lunch_break_duration: number;
  day_start: string;
  day_end: string;
  daily_capacity_override: number | null;
  updated_at: string;
}

export interface WeeklyScheduleTemplate {
  id: string;
  dealer_id: string;
  day_of_week: number;
  scheduled_time: string;
  planned_19l: number;
  planned_10l: number;
  sort_order: number;
  created_at: string;
}

export type SlotStatus = 'scheduled' | 'moved_out' | 'cancelled' | 'extra';
export type ChangeType = 'moved_in' | 'moved_out' | 'swapped' | 'cancelled' | 'extra' | null;

export interface DailySchedule {
  id: string;
  slot_date: string;
  dealer_id: string;
  scheduled_time: string;
  planned_19l: number;
  planned_10l: number;
  status: SlotStatus;
  change_type: ChangeType;
  original_date: string | null;
  swapped_with_dealer_id: string | null;
  change_note: string;
  template_slot_id: string | null;
  created_at: string;
}

export type VisitStatus = 'pending' | 'arrived' | 'completed' | 'no_show';

export interface VisitRecord {
  id: string;
  daily_schedule_id: string;
  slot_date: string;
  dealer_id: string;
  status: VisitStatus;
  actual_arrival_time: string | null;
  bottles_19l_in: number;
  bottles_19l_out: number;
  bottles_10l_in: number;
  bottles_10l_out: number;
  bottles_home: number;
  notes: string;
  recorded_by: string;
  synced_to_sheets: boolean;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
  created_at: string;
}

// Joined types for convenience
export interface DailyScheduleWithDealer extends DailySchedule {
  dealer: Dealer;
  swapped_with_dealer?: Dealer | null;
  visit_record?: VisitRecord | null;
}

export interface WeeklyTemplateWithDealer extends WeeklyScheduleTemplate {
  dealer: Dealer;
}
