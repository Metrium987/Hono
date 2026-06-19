-- Phase 4.5: Fix nullable columns that should be NOT NULL
-- These columns are nullable in the schema but every row should have a value.

-- First set any null team_ids to a placeholder (orphaned rows)
UPDATE tax_rates SET team_id = (SELECT id FROM teams LIMIT 1) WHERE team_id IS NULL;
UPDATE currencies SET team_id = (SELECT id FROM teams LIMIT 1) WHERE team_id IS NULL;
UPDATE payment_methods SET team_id = (SELECT id FROM teams LIMIT 1) WHERE team_id IS NULL;

ALTER TABLE tax_rates ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE currencies ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE payment_methods ALTER COLUMN team_id SET NOT NULL;
