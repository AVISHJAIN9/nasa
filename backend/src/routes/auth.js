import { Router } from 'express';
import { z } from 'zod';
import { loginUser, refreshAccessToken, registerUser } from '../services/authService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['astronaut', 'flight_surgeon', 'mission_control', 'admin']).default('astronaut'),
  crew_id: z.string().nullable().optional()
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1)
});

router.post('/api/v1/auth/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await registerUser(data);
    return res.status(201).json(user.toJSON());
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const result = await loginUser(username, password);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/auth/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = refreshSchema.parse(req.body);
    const result = await refreshAccessToken(refresh_token);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/auth/me', authenticateToken, (req, res) => {
  return res.json({ user: req.user });
});

// Role-based authorization verification endpoints
router.get('/api/v1/auth/astronaut-only', requireRole('astronaut'), (req, res) => {
  return res.json({ message: 'Welcome astronaut', user: req.user });
});

router.get('/api/v1/auth/surgeon-only', requireRole('flight_surgeon'), (req, res) => {
  return res.json({ message: 'Welcome flight surgeon', user: req.user });
});

router.get('/api/v1/auth/mission-control-only', requireRole('mission_control'), (req, res) => {
  return res.json({ message: 'Welcome mission control', user: req.user });
});

router.get('/api/v1/auth/admin-only', requireRole('admin'), (req, res) => {
  return res.json({ message: 'Welcome admin', user: req.user });
});

export default router;
