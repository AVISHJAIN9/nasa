import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';
import { seedDemoData } from '../src/services/demoSeedService.js';
import { Alert } from '../src/models/Alert.js';
import { ClinicalOrder } from '../src/models/ClinicalOrder.js';
import { BroadcastAnnouncement } from '../src/models/BroadcastAnnouncement.js';
import { CheckInRecord } from '../src/models/CheckInRecord.js';

describe('Batch 3.1: Auth, Role Policy & Fused Today Endpoint', () => {
  let app;
  let okoyeToken;
  let vegaToken;
  let surgeonToken;
  let controlToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodbUri);
    }
    app = await createApp();
    await seedDemoData({ reset: false });

    // Login as Okoye
    const okoyeLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'okoye', password: 'Password123!' });
    expect(okoyeLogin.status).toBe(200);
    expect(okoyeLogin.body.access_token).toBeDefined();
    okoyeToken = okoyeLogin.body.access_token;

    // Login as Vega
    const vegaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'vega', password: 'Password123!' });
    expect(vegaLogin.status).toBe(200);
    vegaToken = vegaLogin.body.access_token;

    // Login as Surgeon
    const surgeonLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'surgeon', password: 'Password123!' });
    expect(surgeonLogin.status).toBe(200);
    surgeonToken = surgeonLogin.body.access_token;

    // Login as Control
    const controlLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'control', password: 'Password123!' });
    expect(controlLogin.status).toBe(200);
    controlToken = controlLogin.body.access_token;
  });

  afterAll(async () => {
    // Cleanup test orders & broadcasts
    await ClinicalOrder.deleteMany({ instructions: { $regex: /test-b31/ } });
    await BroadcastAnnouncement.deleteMany({ title: { $regex: /test-b31/ } });
    await CheckInRecord.deleteMany({ notes: { $regex: /test-b31/ } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('Rejects unauthenticated requests with 401 Unauthorized', async () => {
    const resOrders = await request(app).post('/api/v1/orders').send({
      target_crew_id: 'okoye',
      title: 'Rest Order',
      instructions: 'test-b31 rest'
    });
    expect(resOrders.status).toBe(401);

    const resBroadcast = await request(app).post('/api/v1/broadcasts').send({
      sender_id: 'anon',
      title: 'test-b31 Announcement',
      message: 'test-b31 message'
    });
    expect(resBroadcast.status).toBe(401);
  });

  it('Rejects unauthorized role requests with 403 Forbidden', async () => {
    // Astronaut attempting to create clinical order
    const resOrder = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${okoyeToken}`)
      .send({
        target_crew_id: 'vega',
        title: 'Med Order',
        instructions: 'test-b31 unauthorized'
      });
    expect(resOrder.status).toBe(403);

    // Astronaut attempting to broadcast
    const resBroadcast = await request(app)
      .post('/api/v1/broadcasts')
      .set('Authorization', `Bearer ${okoyeToken}`)
      .send({
        sender_id: 'okoye',
        title: 'test-b31 Broadcast',
        message: 'test-b31 unauthorized broadcast'
      });
    expect(resBroadcast.status).toBe(403);

    // Astronaut Okoye attempting to view Vega check-ins
    const resCheckins = await request(app)
      .get('/api/v1/checkins?crew_id=vega')
      .set('Authorization', `Bearer ${okoyeToken}`);
    expect(resCheckins.status).toBe(403);

    // Astronaut Okoye attempting to view Vega orders
    const resOrders = await request(app)
      .get('/api/v1/orders/crew/vega')
      .set('Authorization', `Bearer ${okoyeToken}`);
    expect(resOrders.status).toBe(403);
  });

  it('Okoye (astronaut): Can write check-in and read own orders', async () => {
    const resCheckin = await request(app)
      .post('/api/v1/checkins')
      .set('Authorization', `Bearer ${okoyeToken}`)
      .send({
        crew_id: 'okoye',
        mood: 5,
        energy: 4,
        notes: 'test-b31 okoye nominal checkin'
      });
    expect(resCheckin.status).toBe(201);
    expect(resCheckin.body.data.crew_id).toBe('okoye');

    const resOrders = await request(app)
      .get('/api/v1/orders/crew/okoye')
      .set('Authorization', `Bearer ${okoyeToken}`);
    expect(resOrders.status).toBe(200);
    expect(resOrders.body.status).toBe('success');
  });

  it('Surgeon (flight_surgeon): Can read Okoye check-in, write order, and write SOAP note', async () => {
    const resCheckin = await request(app)
      .get('/api/v1/checkins?crew_id=okoye')
      .set('Authorization', `Bearer ${surgeonToken}`);
    expect(resCheckin.status).toBe(200);
    expect(resCheckin.body.status).toBe('success');
    expect(Array.isArray(resCheckin.body.data)).toBe(true);

    const resOrder = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${surgeonToken}`)
      .send({
        target_crew_id: 'okoye',
        type: 'EXERCISE',
        title: 'ARED Protocol',
        instructions: 'test-b31 45min resistance exercise',
        priority: 'ROUTINE'
      });
    expect(resOrder.status).toBe(201);
    expect(resOrder.body.data.target_crew_id).toBe('okoye');

    const resNote = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${surgeonToken}`)
      .send({
        crew_id: 'okoye',
        author_name: 'Dr. Priya Nair',
        subjective: 'test-b31 Subjective note',
        objective: 'test-b31 Objective vitals nominal',
        assessment: 'test-b31 Fit for duty',
        plan: 'test-b31 Continue scheduled workload'
      });
    expect(resNote.status).toBe(201);
    expect(resNote.body.data.crew_id).toBe('okoye');
  });

  it('Control (mission_control): Can send mission broadcast', async () => {
    const resBroadcast = await request(app)
      .post('/api/v1/broadcasts')
      .set('Authorization', `Bearer ${controlToken}`)
      .send({
        sender_id: 'flight_director',
        sender_name: 'Flight Director Houston',
        priority: 'normal',
        title: 'test-b31 Mars Orbit Insertion Prep',
        message: 'All stations prepare for telemetry downlink pass.',
        target_audience: 'all'
      });
    expect(resBroadcast.status).toBe(201);
    expect(resBroadcast.body.title).toContain('Mars Orbit Insertion Prep');
  });

  it('GET /v1/today returns fused status and handles FastAPI downtime with degraded: true', async () => {
    const resToday = await request(app).get('/v1/today?person_id=okoye');
    expect(resToday.status).toBe(200);
    expect(resToday.body.person_id).toBe('okoye');
    expect(resToday.body.state).toBeDefined();
    expect(resToday.body.band).toBeDefined();
    expect(resToday.body.crew_band).toBeDefined();
    expect(resToday.body.clinical_summary).toBeDefined();

    // If FastAPI is running or stopped, it must return a valid JSON object without 500 error
    expect(typeof resToday.body.degraded).toBe('boolean');
    if (resToday.body.degraded) {
      expect(resToday.body.missing_keys).toEqual(expect.arrayContaining(['voice', 'behavior', 'passive']));
    }
  });
});
