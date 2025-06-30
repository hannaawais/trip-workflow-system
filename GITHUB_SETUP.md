# GitHub Setup Guide

## Quick Setup Instructions

1. **Create New Repository on GitHub:**
   - Go to github.com and click "New repository"
   - Name: `trip-workflow-system` (or your preferred name)
   - Description: "Enterprise Transportation & Budget Management System"
   - Make it Public or Private (your choice)
   - Don't initialize with README (we have one)

2. **Upload Files:**
   - Click "uploading an existing file" 
   - Drag and drop ALL the files from your project
   - Or use "choose your files" to select all files

## Project Structure to Upload

```
trip-workflow-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and helpers
│   └── index.html
├── server/                 # Express backend
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   ├── auth.ts             # Authentication
│   └── index.ts            # Server entry point
├── shared/
│   └── schema.ts           # Database schema & types
├── package.json            # Dependencies
├── README.md               # Project documentation
├── .gitignore              # Git ignore rules
└── Configuration files (*.config.ts, *.json)
```

## Environment Setup for Contributors

After cloning, contributors need to:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set Environment Variables:**
   ```bash
   DATABASE_URL=your_postgresql_url
   SESSION_SECRET=your_session_secret
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

## Features Included

- ✅ Enhanced approval dialog with comprehensive trip details
- ✅ Budget tracking and validation
- ✅ Role-based permissions (Employee, Manager, Finance, Admin)
- ✅ Multi-step workflow approvals
- ✅ Project and department management
- ✅ Audit trail and reporting
- ✅ Document upload system
- ✅ Distance calculation and KM rate management

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Passport.js with session management
- **Build:** Vite for frontend, esbuild for backend