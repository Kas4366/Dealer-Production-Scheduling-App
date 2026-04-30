/*
  # Add dealer color and slot redistribution log

  1. Changes
    - `dealers` table: add `color` column (hex string) for persistent dealer color assignment
  
  2. New Tables
    - `slot_redistribution_log`
      - `id` (uuid, primary key)
      - `holiday_date` (date) - the holiday that triggered the redistribution
      - `action` (text) - 'redistribute' or 'undo'
      - `affected_slot_ids` (uuid[]) - daily_schedule slot IDs moved
      - `slot_snapshot` (jsonb) - snapshot of the moved slots before the action (for undo)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on slot_redistribution_log
    - Allow all authenticated and anonymous users to read/write (same open policy pattern as other tables in this app)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dealers' AND column_name = 'color'
  ) THEN
    ALTER TABLE dealers ADD COLUMN color text DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS slot_redistribution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  action text NOT NULL CHECK (action IN ('redistribute', 'undo')),
  affected_slot_ids uuid[] NOT NULL DEFAULT '{}',
  slot_snapshot jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slot_redistribution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to redistribution log"
  ON slot_redistribution_log
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert to redistribution log"
  ON slot_redistribution_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow delete from redistribution log"
  ON slot_redistribution_log
  FOR DELETE
  TO anon, authenticated
  USING (true);
