import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { decryptField, encryptField, scanFileForSecrets } from '../services/security.js';

const router = Router();

const encryptSchema = z.object({
  plaintext: z.string().min(1)
});

const decryptSchema = z.object({
  ciphertext: z.string().min(1)
});

router.post('/api/v1/security/encrypt', (req, res, next) => {
  try {
    const { plaintext } = encryptSchema.parse(req.body);
    const ciphertext = encryptField(plaintext);
    return res.json({ ciphertext, algorithm: 'AES-256-GCM' });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/security/decrypt', (req, res, next) => {
  try {
    const { ciphertext } = decryptSchema.parse(req.body);
    const plaintext = decryptField(ciphertext);
    return res.json({ plaintext, algorithm: 'AES-256-GCM' });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/security/scan', (req, res) => {
  const repoRoot = process.cwd();
  let filesScanned = 0;
  const allFindings = [];

  const scanDirs = ['backend', 'scripts', 'tests'];
  for (const dir of scanDirs) {
    const dirPath = path.join(repoRoot, dir);
    if (!fs.existsSync(dirPath)) continue;

    function walk(curr) {
      const entries = fs.readdirSync(curr, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(curr, ent.name);
        if (ent.isDirectory()) {
          if (!['node_modules', '.git', 'legacy_python'].includes(ent.name)) {
            walk(full);
          }
        } else if (/\.(js|json|md|yml|yaml)$/.test(ent.name)) {
          filesScanned++;
          const issues = scanFileForSecrets(full);
          for (const item of issues) {
            allFindings.push({
              file: path.relative(repoRoot, full),
              line: item.line,
              match: item.match
            });
          }
        }
      }
    }
    walk(dirPath);
  }

  return res.json({
    files_scanned: filesScanned,
    findings_count: allFindings.length,
    findings: allFindings,
    clean: allFindings.length === 0
  });
});

export default router;
