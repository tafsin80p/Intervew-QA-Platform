import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, dbRun, dbGet } from '../database.js';
import { ADMIN_SECRET_KEY } from '../constants.js';

// Simple UUID generator
const uuidv4 = () => {
  return crypto.randomUUID();
};

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName, adminSecretKey } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await dbGet(db, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if admin secret key is provided
    const isAdmin = adminSecretKey && adminSecretKey.trim() === ADMIN_SECRET_KEY;

    // Create user
    const userId = uuidv4();
    await dbRun(db, `
      INSERT INTO users (id, email, password_hash, display_name, is_admin)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId,
      email.toLowerCase().trim(),
      passwordHash,
      displayName || email.split('@')[0],
      isAdmin ? 1 : 0
    ]);

    // Generate JWT token
    const token = jwt.sign(
      { userId, email: email.toLowerCase().trim(), isAdmin },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        email: email.toLowerCase().trim(),
        displayName: displayName || email.split('@')[0],
        isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password, adminSecretKey } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user.is_blocked === 1) {
      return res.status(403).json({ 
        error: 'Account blocked',
        blockedReason: user.blocked_reason || 'Your account has been blocked due to violations.',
      });
    }

    // Check if admin secret key is provided
    let isAdmin = user.is_admin === 1;
    if (adminSecretKey && adminSecretKey.trim() === ADMIN_SECRET_KEY) {
      // Update user to admin if secret key is correct
      await dbRun(db, 'UPDATE users SET is_admin = 1 WHERE id = ?', [user.id]);
      isAdmin = true;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token middleware
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Verify admin middleware
export const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export default router;

