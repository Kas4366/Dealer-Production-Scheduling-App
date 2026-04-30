
/*
  # Water Bottle Filling Production Schedule - Initial Schema

  ## Overview
  Complete database schema for managing water bottle filling dealer schedules,
  visit tracking, holiday redistribution, and production monitoring.

  ## New Tables

  ### dealers
  - Stores all dealer information including their bottle type capacities
  - Fields: id, name, code (short name like KD/PMN), max_19l, max_10l, active, created_at

  ### production_settings
  - Single-row config table for fill speed, break times, working hours
  - Fields: id, fill_speed_per_hour, morning_break_start, morning_break_duration,
    lunch_break_start, lunch_break_duration, day_start, day_end, updated_at

  ### weekly_schedule_templates
  - Recurring weekly slot pattern (day of week + time + dealer + quantities)
  - Fields: id, dealer_id, day_of_week (0=Mon..5=Sat), scheduled_time, planned_19l, planned_10l, sort_order

  ### daily_schedule
  - Actual calendar date slots generated from templates or manually added
  - Includes change tracking fields for moves, swaps, cancellations
  - Fields: id, slot_date, dealer_id, scheduled_time, planned_19l, planned_10l,
    status (scheduled/moved_out/cancelled/extra), change_type, original_date,
    swapped_with_dealer_id, change_note, template_slot_id

  ### visit_records
  - Actual visit outcome per slot - bottle counts, arrival time, status
  - Fields: id, daily_schedule_id, slot_date, dealer_id, status, actual_arrival_time,
    bottles_19l_in, bottles_19l_out, bottles_10l_in, bottles_10l_out, notes, recorded_by, synced_to_sheets

  ### holidays
  - Holiday dates with names
  - Fields: id, holiday_date, name, created_at

  ## Security
  - RLS enabled on all tables
  - Public read/write access (auth will be added later as planned)

  ## Notes
  - Auth will be added in a future phase; for now policies allow all operations
  - production_settings uses a single row enforced by a check constraint
*/

-- Dealers table
CREATE TABLE IF NOT EXISTS dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  max_19l integer NOT NULL DEFAULT 0,
  max_10l integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  contact text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read dealers"
  ON dealers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert dealers"
  ON dealers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public update dealers"
  ON dealers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Production settings (single row)
CREATE TABLE IF NOT EXISTS production_settings (
  id integer PRIMARY KEY DEFAULT 1,
  fill_speed_per_hour integer NOT NULL DEFAULT 300,
  morning_break_start time NOT NULL DEFAULT '10:00',
  morning_break_duration integer NOT NULL DEFAULT 15,
  lunch_break_start time NOT NULL DEFAULT '12:30',
  lunch_break_duration integer NOT NULL DEFAULT 30,
  day_start time NOT NULL DEFAULT '07:30',
  day_end time NOT NULL DEFAULT '17:00',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE production_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings"
  ON production_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public update settings"
  ON production_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public insert settings"
  ON production_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Insert default settings row
INSERT INTO production_settings (id, fill_speed_per_hour, morning_break_start, morning_break_duration, lunch_break_start, lunch_break_duration, day_start, day_end)
VALUES (1, 300, '10:00', 15, '12:30', 30, '07:30', '17:00')
ON CONFLICT (id) DO NOTHING;

-- Weekly schedule templates
CREATE TABLE IF NOT EXISTS weekly_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES dealers(id),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  scheduled_time time NOT NULL,
  planned_19l integer NOT NULL DEFAULT 0,
  planned_10l integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read templates"
  ON weekly_schedule_templates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert templates"
  ON weekly_schedule_templates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public update templates"
  ON weekly_schedule_templates FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete templates"
  ON weekly_schedule_templates FOR DELETE
  TO anon, authenticated
  USING (true);

-- Daily schedule (actual calendar entries)
CREATE TABLE IF NOT EXISTS daily_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date date NOT NULL,
  dealer_id uuid NOT NULL REFERENCES dealers(id),
  scheduled_time time NOT NULL,
  planned_19l integer NOT NULL DEFAULT 0,
  planned_10l integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'moved_out', 'cancelled', 'extra')),
  change_type text CHECK (change_type IN ('moved_in', 'moved_out', 'swapped', 'cancelled', 'extra', NULL)),
  original_date date,
  swapped_with_dealer_id uuid REFERENCES dealers(id),
  change_note text DEFAULT '',
  template_slot_id uuid REFERENCES weekly_schedule_templates(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_schedule_date ON daily_schedule(slot_date);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_dealer ON daily_schedule(dealer_id);

ALTER TABLE daily_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_schedule"
  ON daily_schedule FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert daily_schedule"
  ON daily_schedule FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public update daily_schedule"
  ON daily_schedule FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete daily_schedule"
  ON daily_schedule FOR DELETE
  TO anon, authenticated
  USING (true);

-- Visit records (actual outcomes)
CREATE TABLE IF NOT EXISTS visit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_schedule_id uuid NOT NULL REFERENCES daily_schedule(id),
  slot_date date NOT NULL,
  dealer_id uuid NOT NULL REFERENCES dealers(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'no_show')),
  actual_arrival_time time,
  bottles_19l_in integer DEFAULT 0,
  bottles_19l_out integer DEFAULT 0,
  bottles_10l_in integer DEFAULT 0,
  bottles_10l_out integer DEFAULT 0,
  notes text DEFAULT '',
  recorded_by text DEFAULT '',
  synced_to_sheets boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_records_date ON visit_records(slot_date);
CREATE INDEX IF NOT EXISTS idx_visit_records_dealer ON visit_records(dealer_id);
CREATE INDEX IF NOT EXISTS idx_visit_records_unsynced ON visit_records(synced_to_sheets) WHERE synced_to_sheets = false;

ALTER TABLE visit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read visit_records"
  ON visit_records FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert visit_records"
  ON visit_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public update visit_records"
  ON visit_records FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read holidays"
  ON holidays FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert holidays"
  ON holidays FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public delete holidays"
  ON holidays FOR DELETE
  TO anon, authenticated
  USING (true);
