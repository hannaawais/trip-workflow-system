-- Migration to add two new fields to users table
-- 1. direct_manager_name: The user can update it in their profile
-- 2. direct_cost_entry_permission: Only admin can change, default is false (No)

-- Check if the columns exist before adding them
DO $$ 
BEGIN
  -- Add direct_manager_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'direct_manager_name'
  ) THEN
    ALTER TABLE users ADD COLUMN direct_manager_name TEXT;
  END IF;
  
  -- Add direct_cost_entry_permission column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'direct_cost_entry_permission'
  ) THEN
    ALTER TABLE users ADD COLUMN direct_cost_entry_permission BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;