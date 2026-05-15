/*
  # Add Sheet Row Number to Visit Records

  1. Changes
    - `visit_records` table: new `sheet_row_number` integer column (nullable, default null)
      Stores the Google Sheet row index where this visit record was last synced.
      When non-null, the sync function deletes that row and re-appends so the sheet
      stays up-to-date without accumulating duplicate rows.

  2. Notes
    - Nullable: existing records that have never been synced (or were synced before
      this column existed) will have null, and will be treated as new appends on
      the next sync.
    - No RLS changes required — the column follows the same access rules as the
      parent table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_records' AND column_name = 'sheet_row_number'
  ) THEN
    ALTER TABLE visit_records ADD COLUMN sheet_row_number integer DEFAULT NULL;
  END IF;
END $$;
