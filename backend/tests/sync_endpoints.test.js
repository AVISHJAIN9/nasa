import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { Alert } from '../src/models/Alert.js';
import { CheckInRecord } from '../src/models/CheckInRecord.js';
import { SoapNote } from '../src/models/SoapNote.js';
import { generateTokens } from '../src/services/authService.js';

describe('Sync Endpoints: Alerts, Check-ins, Notes', () => {
  let app;
  let surgeonToken;
  let okoyeToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodbUri);
    }
    app = await createApp();
    surgeonToken = generateTokens({
      id: 'surgeon-test',
      username: 'surgeon',
      role: 'flight_surgeon',
      crew_id: null
    }).access_token;
    okoyeToken = generateTokens({
      id: 'okoye-test',
      username: 'okoye',
      role: 'astronaut',
      crew_id: 'okoye'
    }).access_token;
  });

  afterAll(async () => {
    // Clean up test records
    await Alert.deleteMany({ alert_id: { $regex: /^test-sync-/ } });
    await CheckInRecord.deleteMany({ checkin_id: { $regex: /^test-sync-/ } });
    await SoapNote.deleteMany({ note_id: { $regex: /^test-sync-/ } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('POST /api/v1/alerts creates alert idempotently with client-generated ID', async () => {
    const payload = {
      id: 'test-sync-alert-1',
      crew_id: 'vega',
      severity: 'WARNING',
      title: 'Elevated Heart Rate',
      message: 'Resting pulse exceeded 100 bpm',
      status: 'ACTIVE'
    };

    const res1 = await request(app).post('/api/v1/alerts').send(payload);
    expect(res1.status).toBe(201);
    expect(res1.body.status).toBe('success');
    expect(res1.body.data.alert_id).toBe('test-sync-alert-1');

    // Idempotent second post
    const res2 = await request(app).post('/api/v1/alerts').send(payload);
    expect(res2.status).toBe(201);
    expect(res2.body.data.alert_id).toBe('test-sync-alert-1');
  });

  it('POST /api/v1/checkins creates check-in idempotently and GET /api/v1/checkins fetches it', async () => {
    const payload = {
      id: 'test-sync-chk-1',
      crewId: 'okoye',
      mood: 4,
      energy: 5,
      pain: 1,
      symptoms: ['mild headache'],
      status: 'synced'
    };

    const resPost = await request(app)
      .post('/api/v1/checkins')
      .set('Authorization', `Bearer ${okoyeToken}`)
      .send(payload);
    expect(resPost.status).toBe(201);
    expect(resPost.body.data.checkin_id).toBe('test-sync-chk-1');

    const resGet = await request(app)
      .get('/api/v1/checkins?crew_id=okoye')
      .set('Authorization', `Bearer ${okoyeToken}`);
    expect(resGet.status).toBe(200);
    expect(Array.isArray(resGet.body.data)).toBe(true);
    const found = resGet.body.data.find((c) => c.checkin_id === 'test-sync-chk-1');
    expect(found).toBeDefined();
    expect(found.mood).toBe(4);
  });

  it('POST /api/v1/notes creates SOAP note with versions and GET /api/v1/notes fetches it', async () => {
    const payload = {
      id: 'test-sync-note-1',
      crewId: 'vega',
      author: 'Dr. Priya Nair',
      subjective: 'Astronaut reports headache post-EVA.',
      objective: 'BP 125/82, HR 76, SpO2 99%.',
      assessment: 'Cephalad fluid shift headache, mild.',
      plan: 'Hydration protocol and rest.'
    };

    const resPost = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${surgeonToken}`)
      .send(payload);
    expect(resPost.status).toBe(201);
    expect(resPost.body.data.note_id).toBe('test-sync-note-1');
    expect(resPost.body.data.version).toBe(1);

    const resGet = await request(app)
      .get('/api/v1/notes?crew_id=vega')
      .set('Authorization', `Bearer ${surgeonToken}`);
    expect(resGet.status).toBe(200);
    const found = resGet.body.data.find((n) => n.note_id === 'test-sync-note-1');
    expect(found).toBeDefined();
    expect(found.assessment).toContain('Cephalad fluid shift');
  });
});
