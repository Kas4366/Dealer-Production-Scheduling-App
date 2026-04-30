/*
  # Add daily capacity override to production_settings

  ## Changes
  - Adds `daily_capacity_override` (nullable integer) to production_settings
  - When set, the app uses this value as the daily production limit instead of calculating it from fill speed and working hours
  - When NULL, the app falls back to the auto-calculated value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_settings' AND column_name = 'daily_capacity_override'
  ) THEN
    ALTER TABLE production_settings ADD COLUMN daily_capacity_override integer DEFAULT NULL;
  END IF;
END $$;
