
-- Add intake integration columns to assessments table
ALTER TABLE assessments ADD COLUMN intake_form_id TEXT;
ALTER TABLE assessments ADD COLUMN type TEXT DEFAULT 'standard';

-- Update existing assessments to have default type
UPDATE assessments SET type = 'standard' WHERE type IS NULL;
