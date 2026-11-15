import crypto from 'crypto';
import fs from 'fs';
import { config } from '../config/index.js';

function getEncryptionKey() {
  const b64 = config.fieldEncryptionKey;
  try {
    const raw = Buffer.from(b64, 'base64');
    if (raw.length === 32) return raw;
    const buf = Buffer.alloc(32);
    raw.copy(buf);
    return buf;
  } catch {
    return Buffer.from('AstroCare32ByteEncryptionKey2026', 'utf-8');
  }
}

export function encryptField(plaintext) {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Combined: nonce (12) + ciphertext + tag (16)
  const combined = Buffer.concat([nonce, encrypted, tag]);
  return combined.toString('base64');
}

export function decryptField(encodedCiphertext) {
  if (!encodedCiphertext) return '';
  const key = getEncryptionKey();
  const raw = Buffer.from(encodedCiphertext, 'base64');
  const nonce = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(12, raw.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

export function maskSecret(secret, start = 2, end = 2) {
  if (!secret) return '';
  if (secret.length <= start + end) return '***';
  return `${secret.slice(0, start)}***${secret.slice(-end)}`;
}

const SECRET_PATTERNS = [
  /(?:password|passwd|pwd|secret|api_key|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{16,}['"]/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /bearer\s+[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}/i
];

export function scanFileForSecrets(filepath) {
  const findings = [];
  if (!fs.existsSync(filepath)) return findings;

  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('change_this') || line.includes('dummy') || line.includes('example') || line.includes('placeholder')) {
      continue;
    }
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.append ? findings.append({ line: i + 1, match: maskSecret(line.trim()) }) : findings.push({ line: i + 1, match: maskSecret(line.trim()) });
      }
    }
  }
  return findings;
}
