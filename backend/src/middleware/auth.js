import { verifyToken } from '../services/authService.js';
import { ForbiddenException, UnauthorizedException } from './errors.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new UnauthorizedException('Authorization header missing'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next(new UnauthorizedException('Invalid authorization format; must be Bearer <token>'));
  }

  try {
    const decoded = verifyToken(parts[1]);
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return authenticateToken(req, res, (err) => {
        if (err) return next(err);
        checkRole(req, roles, next);
      });
    }

    checkRole(req, roles, next);
  };
}

function checkRole(req, roles, next) {
  if (roles.length > 0 && !roles.includes(req.user.role)) {
    return next(
      new ForbiddenException(`Role '${req.user.role}' lacks permission for this resource. Required: [${roles.join(', ')}]`)
    );
  }
  next();
}
