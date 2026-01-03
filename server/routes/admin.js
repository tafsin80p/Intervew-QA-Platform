import express from 'express';
import { db, dbAll, dbRun, dbGet } from '../database.js';
import { verifyToken, verifyAdmin } from './auth.js';

const router = express.Router();

// Get all users with their quiz data
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Get all users from users table
    const allUsers = await dbAll(db, 'SELECT * FROM users ORDER BY created_at DESC');

    // Get all quiz results
    const allResults = await dbAll(db, `
      SELECT * FROM quiz_results
      ORDER BY completed_at DESC
    `);

    // Process results to create user list
    const userMap = new Map();

    // First, add all users (including those without quiz results)
    allUsers.forEach((user) => {
      userMap.set(user.id, {
        id: user.id,
        name: user.display_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        status: 'pending',
        quizType: null,
        score: null,
        completedAt: null,
        latestQuizId: null,
        isBlocked: user.is_blocked === 1,
        warningCount: user.warning_count || 0,
        restartCount: user.quiz_restart_count || 0,
        blockedReason: user.blocked_reason,
        blockedAt: user.blocked_at,
      });
    });

    // Group results by user_id to determine quiz types
    const resultsByUser = new Map();
    allResults.forEach((result) => {
      const userId = result.user_id;
      if (!userId) return;
      
      if (!resultsByUser.has(userId)) {
        resultsByUser.set(userId, []);
      }
      resultsByUser.get(userId).push(result);
    });

    // Update users with quiz data
    for (const [userId, userResults] of resultsByUser.entries()) {
      // Find the latest result
      const latestResult = userResults.reduce((latest, current) => {
        const currentDate = new Date(current.completed_at);
        const latestDate = latest ? new Date(latest.completed_at) : null;
        return !latestDate || currentDate > latestDate ? current : latest;
      }, null);

      if (!latestResult) continue;

      // Determine quiz types for this user
      const hasPlugin = userResults.some(r => r.quiz_type === 'plugin');
      const hasTheme = userResults.some(r => r.quiz_type === 'theme');
      const quizType = hasPlugin && hasTheme ? 'both' : hasPlugin ? 'plugin' : hasTheme ? 'theme' : null;

      const user = dbGet(db, 'SELECT is_blocked, warning_count, quiz_restart_count, blocked_reason, blocked_at FROM users WHERE id = ?', [userId]);

      // Get user info from existing map or from latest result
      const existingUser = userMap.get(userId);
      
      userMap.set(userId, {
        id: userId,
        name: latestResult.user_name || existingUser?.name || latestResult.user_email?.split('@')[0] || 'User',
        email: existingUser?.email || latestResult.user_email,
        status: latestResult.status || 'pending',
        quizType: quizType,
        score: Math.round((latestResult.score / latestResult.total_questions) * 100),
        completedAt: latestResult.completed_at,
        latestQuizId: latestResult.id,
        isBlocked: user?.is_blocked === 1,
        warningCount: user?.warning_count || 0,
        restartCount: user?.quiz_restart_count || 0,
        blockedReason: user?.blocked_reason,
        blockedAt: user?.blocked_at,
      });
    }

    const usersList = Array.from(userMap.values());
    res.json({ users: usersList, total: usersList.length });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all quiz results
router.get('/results', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const results = await dbAll(db, `
      SELECT * FROM quiz_results
      ORDER BY completed_at DESC
    `);

    // Parse detailed_answers JSON
    const formattedResults = results.map(result => ({
      ...result,
      detailed_answers: JSON.parse(result.detailed_answers),
    }));

    res.json({ results: formattedResults, total: formattedResults.length });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user status
router.patch('/users/:userId/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!status || !['selected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "selected" or "pending"' });
    }

    // Update all quiz results for this user
    await dbRun(db, `
      UPDATE quiz_results
      SET status = ?
      WHERE user_id = ?
    `, [status, userId]);

    res.json({ message: `User status updated to ${status}` });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user's quiz results
router.delete('/users/:userId/results', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete all quiz results for this user
    await dbRun(db, 'DELETE FROM quiz_results WHERE user_id = ?', [userId]);

    res.json({ message: 'User quiz results deleted successfully' });
  } catch (error) {
    console.error('Error deleting user results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user warnings (public endpoint for users to check their own warnings)
router.get('/users/:userId/warnings', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    // Users can only check their own warnings, admins can check any user's warnings
    if (userId !== requestingUserId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = dbGet(db, 'SELECT warning_count, is_blocked FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      warningCount: user.warning_count || 0,
      isBlocked: user.is_blocked === 1,
    });
  } catch (error) {
    console.error('Error fetching user warnings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user warnings
router.patch('/users/:userId/warnings', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { warningCount } = req.body;
    const requestingUserId = req.user.userId;

    // Users can only update their own warnings, admins can update any user's warnings
    if (userId !== requestingUserId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (typeof warningCount !== 'number' || warningCount < 0) {
      return res.status(400).json({ error: 'Invalid warning count' });
    }

    await dbRun(db, `
      UPDATE users
      SET warning_count = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [warningCount, userId]);

    res.json({ message: 'Warning count updated successfully' });
  } catch (error) {
    console.error('Error updating user warnings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Block user (admin only)
router.post('/users/:userId/block', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Block reason is required' });
    }

    await dbRun(db, `
      UPDATE users
      SET is_blocked = 1,
          blocked_reason = ?,
          blocked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `, [reason, userId]);

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unblock user (admin only)
router.post('/users/:userId/unblock', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    await dbRun(db, `
      UPDATE users
      SET is_blocked = 0,
          warning_count = 0,
          quiz_restart_count = 0,
          blocked_reason = NULL,
          blocked_at = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `, [userId]);

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user restart count (public endpoint for users to check their own restarts)
router.get('/users/:userId/restarts', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    // Users can only check their own restarts, admins can check any user's restarts
    if (userId !== requestingUserId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = dbGet(db, 'SELECT quiz_restart_count, is_blocked FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      restartCount: user.quiz_restart_count || 0,
      isBlocked: user.is_blocked === 1,
    });
  } catch (error) {
    console.error('Error fetching user restart count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user restart count
router.patch('/users/:userId/restarts', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { restartCount } = req.body;
    const requestingUserId = req.user.userId;

    // Users can only update their own restarts, admins can update any user's restarts
    if (userId !== requestingUserId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (typeof restartCount !== 'number' || restartCount < 0) {
      return res.status(400).json({ error: 'Invalid restart count' });
    }

    await dbRun(db, `
      UPDATE users
      SET quiz_restart_count = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [restartCount, userId]);

    res.json({ message: 'Restart count updated successfully' });
  } catch (error) {
    console.error('Error updating user restart count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const allResults = await dbAll(db, 'SELECT * FROM quiz_results');

    const totalAttempts = allResults.length;
    const uniqueUsers = new Set(allResults.map(r => r.user_id)).size;
    const averageScore = allResults.length > 0
      ? Math.round((allResults.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0) / allResults.length))
      : 0;
    const averageTime = allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + r.time_taken_seconds, 0) / allResults.length)
      : 0;
    const totalCorrect = allResults.reduce((sum, r) => sum + r.correct_answers, 0);
    const totalWrong = allResults.reduce((sum, r) => sum + r.wrong_answers, 0);
    const pluginAttempts = allResults.filter(r => r.quiz_type === 'plugin').length;
    const themeAttempts = allResults.filter(r => r.quiz_type === 'theme').length;

    res.json({
      totalAttempts,
      uniqueUsers,
      averageScore,
      averageTime,
      totalCorrect,
      totalWrong,
      pluginAttempts,
      themeAttempts,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

