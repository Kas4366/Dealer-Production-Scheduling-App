/*
  # Fix template_slot_id foreign key to allow template deletion

  ## Problem
  The daily_schedule.template_slot_id column references weekly_schedule_templates(id)
  with no ON DELETE action, which defaults to RESTRICT. This means any attempt to
  delete a weekly template slot that has been used to generate daily schedule rows
  will fail silently in the UI.

  ## Changes
  - Drop the existing foreign key constraint on daily_schedule.template_slot_id
  - Re-add it with ON DELETE SET NULL so deleting a template slot nullifies the
    reference on historical daily schedule rows rather than blocking the delete

  ## Effect
  Historical daily schedule records and visit records are fully preserved.
  They simply lose their template_slot_id link, which is correct — the record
  is historical and no longer needs to track which template it came from.
*/

ALTER TABLE daily_schedule
  DROP CONSTRAINT IF EXISTS daily_schedule_template_slot_id_fkey;

ALTER TABLE daily_schedule
  ADD CONSTRAINT daily_schedule_template_slot_id_fkey
  FOREIGN KEY (template_slot_id)
  REFERENCES weekly_schedule_templates(id)
  ON DELETE SET NULL;
