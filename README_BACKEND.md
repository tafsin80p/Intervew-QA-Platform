# WordPress Quiz - Backend Setup Guide

This project now uses a Node.js & Express backend with SQLite database instead of Firebase/Supabase.

## Backend Setup

### 1. Install Dependencies

Navigate to the `server` directory and install dependencies:

```bash
cd server
npm install
```

### 2. Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

**Important**: Change `JWT_SECRET` to a strong random string in production!

### 3. Start the Backend Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will run on `http://localhost:3000` by default.

## Frontend Setup

### 1. Environment Variables

Create or update `.env` in the root directory:

```env
VITE_API_URL=http://localhost:3000/api
```

### 2. Start the Frontend

```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Quiz
- `POST /api/quiz/submit` - Submit quiz results (requires auth)
- `GET /api/quiz/history` - Get user's quiz history (requires auth)

### Admin
- `GET /api/admin/users` - Get all users (requires admin)
- `GET /api/admin/results` - Get all quiz results (requires admin)
- `PATCH /api/admin/users/:userId/status` - Update user status (requires admin)
- `DELETE /api/admin/users/:userId/results` - Delete user's quiz results (requires admin)
- `GET /api/admin/stats` - Get dashboard statistics (requires admin)

## Admin Secret Key

The admin secret key is: `Softvence,Quize,Admin-dashboard`

Users can enter this key during registration or login to gain admin access.

## Database

The backend uses SQLite database (`server/quiz.db`). The database is automatically created when you first start the server.

### Database Schema

- **users**: Stores user accounts
- **quiz_results**: Stores quiz submissions with detailed answers

## Features

- ✅ User registration and login
- ✅ JWT-based authentication
- ✅ Admin secret key support
- ✅ Quiz submission with detailed answers
- ✅ Admin dashboard with user management
- ✅ Status management (selected/pending)
- ✅ User deletion

## Troubleshooting

### Backend not connecting
- Make sure the backend server is running on port 3000
- Check that `VITE_API_URL` in frontend `.env` matches the backend URL
- Verify CORS is enabled (it's enabled by default)

### Database errors
- Delete `server/quiz.db` to reset the database
- Make sure the `server` directory has write permissions

### Authentication issues
- Check that JWT_SECRET is set in backend `.env`
- Clear browser localStorage if tokens are corrupted



