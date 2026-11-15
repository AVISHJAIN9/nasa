import fs from 'fs';
import path from 'path';

export async function autoLoad(directoryPath, handler) {
  if (!fs.existsSync(directoryPath)) return;
  const files = fs.readdirSync(directoryPath).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const fullPath = path.resolve(directoryPath, file);
    const module = await import(fullPath);
    if (handler) {
      await handler(module, file);
    }
  }
}
