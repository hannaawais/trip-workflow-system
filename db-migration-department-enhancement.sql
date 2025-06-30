-- Migration to add the new department fields

-- Add third manager field to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS third_manager_id INTEGER REFERENCES users(id);

-- Add monthly budget bonus and reset date fields
ALTER TABLE departments ADD COLUMN IF NOT EXISTS monthly_budget_bonus REAL NOT NULL DEFAULT 0;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS monthly_budget_bonus_reset_date TIMESTAMP;

-- Add parent department field
ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_department_id INTEGER REFERENCES departments(id);

-- Create index on parent_department_id for faster hierarchical queries
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);

-- Log the migration in the system_settings table
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('migration_department_enhancement', current_timestamp::text, 'Added third manager, monthly budget bonus, and parent department fields')
ON CONFLICT (setting_key) 
DO UPDATE SET setting_value = current_timestamp::text, updated_at = current_timestamp;