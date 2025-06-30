# Local Development Setup Guide

## PostgreSQL 17 Configuration

### 1. Create Database and User
Open PostgreSQL command line (psql) as administrator:

```sql
-- Create database
CREATE DATABASE trip_workflow_db;

-- Create user with password
CREATE USER trip_user WITH ENCRYPTED PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE trip_workflow_db TO trip_user;

-- Connect to the database
\c trip_workflow_db;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO trip_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trip_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trip_user;
```

### 2. Environment Variables Setup

Create a `.env` file in your project root:

```env
# Database Configuration
DATABASE_URL="postgresql://trip_user:your_secure_password@localhost:5432/trip_workflow_db"

# Session Configuration
SESSION_SECRET="your-super-secret-session-key-change-this-in-production"

# PostgreSQL Connection Details (if needed separately)
PGHOST=localhost
PGPORT=5432
PGDATABASE=trip_workflow_db
PGUSER=trip_user
PGPASSWORD=your_secure_password
```

### 3. Initialize Database Schema

Run these commands in your project directory:

```bash
# Install dependencies
npm install

# Push database schema (creates all tables)
npm run db:push

# Optional: Generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 4. Start Development Server

```bash
npm run dev
```

## Troubleshooting

### Connection Issues:
1. **Check PostgreSQL Service**: Ensure PostgreSQL 17 is running
2. **Verify Port**: Default is 5432, check if different
3. **Check Credentials**: Verify username/password in .env file
4. **Firewall**: Ensure local connections are allowed

### Common Commands:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # Mac
services.msc  # Windows (look for PostgreSQL)

# Connect to database manually
psql -U trip_user -d trip_workflow_db -h localhost

# Reset database (if needed)
DROP DATABASE trip_workflow_db;
CREATE DATABASE trip_workflow_db;
```

### Database Schema Will Create:
- users (employees, managers, admins)
- departments (with budgets)
- projects (with budget tracking)
- trip_requests (transportation requests)
- admin_requests (administrative processes)
- workflow_steps (approval workflows)
- audit_logs (system tracking)
- system_settings (configuration)
- km_rates (distance pricing)
- sites (locations)
- distances (route calculations)

## Default Admin User
After schema creation, you can create an admin user through the web interface at `/auth` or manually insert into database.

## Port Configuration
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:5000 (Express API)
- Database: localhost:5432 (PostgreSQL)