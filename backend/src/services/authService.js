import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/index.js';
import { BadRequestException, ConflictException, UnauthorizedException } from '../middleware/errors.js';

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

export async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

export function generateTokens(user) {
  const payload = {
    userId: user._id ? user._id.toString() : user.id,
    username: user.username,
    role: user.role,
    crew_id: user.crew_id
  };

  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: 900 // 15 minutes
  };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Token has expired; please re-login');
    }
    throw new UnauthorizedException('Invalid authentication token');
  }
}

export async function registerUser({ username, email, password, role = 'astronaut', crew_id = null }) {
  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    throw new ConflictException('Username or email already registered');
  }

  const passwordHash = await hashPassword(password);
  const user = new User({
    username,
    email,
    password_hash: passwordHash,
    role,
    crew_id
  });

  await user.save();
  return user;
}

export async function loginUser(usernameOrEmail, password) {
  const user = await User.findOne({
    $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const matches = await comparePassword(password, user.password_hash);
  if (!matches) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const tokens = generateTokens(user);
  return {
    ...tokens,
    user: user.toJSON()
  };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new BadRequestException('Refresh token is required');
  }

  const decoded = verifyToken(refreshToken);
  if (decoded.type !== 'refresh') {
    throw new UnauthorizedException('Invalid refresh token type');
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new UnauthorizedException('User account no longer exists');
  }

  const tokens = generateTokens(user);
  return {
    access_token: tokens.access_token,
    token_type: 'bearer',
    expires_in: tokens.expires_in
  };
}
