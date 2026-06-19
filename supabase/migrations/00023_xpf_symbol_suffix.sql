-- Phase 5.8: Fix XPF default symbol_position
-- XPF uses suffix notation (100 F) but the schema default is 'prefix'.
-- Update existing XPF currencies and set the default for new ones.

UPDATE currencies
SET symbol_position = 'suffix'
WHERE code = 'XPF' AND symbol_position = 'prefix';

-- Also change the table default for future currencies
ALTER TABLE currencies ALTER COLUMN symbol_position SET DEFAULT 'suffix';
