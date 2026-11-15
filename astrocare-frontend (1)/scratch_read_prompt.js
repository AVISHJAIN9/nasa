import fs from 'fs';
const content = fs.readFileSync('C:/Users/abhir/.gemini/antigravity-cli/brain/ac579a49-371a-4a0e-8104-9503442565cf/.system_generated/logs/transcript_full.jsonl', 'utf8');
for (const line of content.split('\n')) {
  if (line.includes('"step_index":231')) {
    const data = JSON.parse(line);
    console.log(data.content);
    break;
  }
}
