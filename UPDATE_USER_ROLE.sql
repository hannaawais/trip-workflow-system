-- Update user role to Admin
-- Replace 'Hanna' with your exact username if different

-- First, check your current user details
SELECT id, "fullName", username, role, department FROM users WHERE username = 'Hanna';

-- Update your role to Admin
UPDATE users SET role = 'Admin' WHERE username = 'Hanna';

-- Verify the change
SELECT id, "fullName", username, role, department FROM users WHERE username = 'Hanna';

-- Optional: Update department to Admin if needed
-- UPDATE users SET department = 'Admin' WHERE username = 'Hanna';