
-- Add tier column to licenses table
ALTER TABLE licenses ADD COLUMN tier TEXT DEFAULT 'basic';

-- Update existing records with appropriate tier based on plan_name
UPDATE licenses 
SET tier = CASE 
  WHEN plan_name LIKE '%Solo%' THEN 'solo'
  WHEN plan_name LIKE '%Team%' THEN 'team'
  WHEN plan_name LIKE '%Enterprise%' THEN 'enterprise'
  WHEN plan_name LIKE '%Independent%' THEN 'independent'
  WHEN plan_name LIKE '%Agency%' THEN 'agency'
  WHEN plan_name LIKE '%Enterprise Agency%' THEN 'enterprise_agency'
  ELSE 'basic'
END;
