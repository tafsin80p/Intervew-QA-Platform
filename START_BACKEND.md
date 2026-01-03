# Quick Start Guide - Backend Server

## The "Failed to fetch" Error

This error occurs because the **backend server is not running**. You need to start the backend server before the frontend can connect to it.

## Steps to Fix:

### 1. Open a NEW terminal window (keep the frontend running in the other terminal)

### 2. Navigate to the server directory:
```bash
cd server
```

### 3. Install dependencies (first time only):
```bash
npm install
```

### 4. Create `.env` file in the `server` directory:
Create a file named `.env` with this content:
```
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

### 5. Start the backend server:
```bash
npm start
```

You should see:
```
🚀 Server running on http://localhost:3000
✅ Database initialized successfully
```

### 6. Now try logging in again in the frontend

The frontend should now be able to connect to the backend!

## Troubleshooting:

- **Port 3000 already in use?** Change `PORT=3001` in server `.env` and update frontend `.env` with `VITE_API_URL=http://localhost:3001/api`
- **Still getting errors?** Make sure both terminals are running:
  - Terminal 1: Frontend (`npm run dev`)
  - Terminal 2: Backend (`cd server && npm start`)

## Quick Commands:

```bash
# Terminal 1 - Frontend (already running)
npm run dev

# Terminal 2 - Backend (NEW terminal)
cd server
npm install  # First time only
npm start
```



