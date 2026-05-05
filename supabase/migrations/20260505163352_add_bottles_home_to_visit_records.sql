/*
  # Add Home Bottles to Visit Records

  1. Changes
    - `visit_records` table: new `bottles_home` integer column (default 0)
      Tracks free home-delivery bottles given to customers, separately from the
      standard 19L and 10L dealer bottle counts.

  2. Notes
    - Safe additive migration — no existing data is affected.
    - Default of 0 means all historical records will show 0 home bottles,
      which is correct (feature did not exist before).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_records' AND column_name = 'bottles_home'
  ) THEN
    ALTER TABLE visit_records ADD COLUMN bottles_home integer NOT NULL DEFAULT 0;
  END IF;
END $$;
