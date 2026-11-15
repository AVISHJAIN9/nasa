import { isFlagEnabled } from '../services/flagService.js';
import { FeatureDisabledException } from './errors.js';

export function requireFlag(flagName) {
  return async (req, res, next) => {
    try {
      const enabled = await isFlagEnabled(flagName);
      if (!enabled) {
        return next(new FeatureDisabledException(flagName));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
