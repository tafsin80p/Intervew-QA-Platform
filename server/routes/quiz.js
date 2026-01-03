import express from 'express';
import crypto from 'crypto';
import { db, dbRun, dbGet } from '../database.js';
import { verifyToken } from './auth.js';

const uuidv4 = () => crypto.randomUUID();

const router = express.Router();

// Submit quiz results
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const {
      quizType,
      difficulty,
      score,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      timeTakenSeconds,
      detailedAnswers,
    } = req.body;

    if (!quizType || !difficulty || score === undefined || !totalQuestions) {
      return res.status(400).json({ error: 'Missing required quiz data' });
    }

    // Get user info
    const user = await dbGet(db, 'SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Save quiz result
    const resultId = uuidv4();
    await dbRun(db, `
      INSERT INTO quiz_results (
        id, user_id, user_email, user_name, quiz_type, difficulty,
        score, total_questions, correct_answers, wrong_answers,
        time_taken_seconds, detailed_answers, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      resultId,
      req.user.userId,
      user.email,
      user.display_name || user.email.split('@')[0],
      quizType,
      difficulty,
      score,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      timeTakenSeconds,
      JSON.stringify(detailedAnswers),
      'pending' // Default status
    ]);

    res.status(201).json({
      message: 'Quiz results saved successfully',
      resultId,
    });
  } catch (error) {
    console.error('Quiz submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's quiz history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const results = await dbAll(db, `
      SELECT * FROM quiz_results
      WHERE user_id = ?
      ORDER BY completed_at DESC
    `, [req.user.userId]);

    // Parse detailed_answers JSON
    const formattedResults = results.map(result => ({
      ...result,
      detailed_answers: JSON.parse(result.detailed_answers),
    }));

    res.json({ results: formattedResults });
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

