import crypto from 'crypto';
import { BroadcastAnnouncement } from '../models/BroadcastAnnouncement.js';
import { NotFoundException } from '../middleware/errors.js';
import { eventBus } from '../bus/index.js';

export async function createBroadcast(data) {
  const announcementId = data.announcement_id || `ann-${crypto.randomBytes(6).toString('hex')}`;

  const announcement = await BroadcastAnnouncement.create({
    announcement_id: announcementId,
    sender_id: data.sender_id,
    sender_name: data.sender_name || 'Flight Surgeon Control',
    priority: data.priority || 'normal',
    title: data.title,
    message: data.message,
    target_audience: data.target_audience || 'all',
    receipts: []
  });

  await eventBus.publish({
    event_type: 'broadcast.announcement.posted',
    channel: 'broadcasts',
    severity: data.priority === 'emergency' ? 'emergency' : 'info',
    payload: announcement.toJSON()
  });

  return announcement.toJSON();
}

export async function recordReadReceipt(announcementId, { user_id, crew_id }) {
  const announcement = await BroadcastAnnouncement.findOne({ announcement_id: announcementId });
  if (!announcement) {
    throw new NotFoundException(`Broadcast announcement '${announcementId}' not found`);
  }

  const existingIdx = announcement.receipts.findIndex((r) => r.user_id === user_id);
  const now = new Date();

  if (existingIdx >= 0) {
    announcement.receipts[existingIdx].read_at = now;
    announcement.receipts[existingIdx].acknowledged = true;
  } else {
    announcement.receipts.push({
      user_id,
      crew_id: crew_id || null,
      read_at: now,
      acknowledged: true
    });
  }

  await announcement.save();

  await eventBus.publish({
    event_type: 'broadcast.receipt.acknowledged',
    channel: 'broadcasts',
    payload: { announcement_id: announcementId, user_id, crew_id, read_at: now }
  });

  return announcement.toJSON();
}

export async function getBroadcastReceipts(announcementId) {
  const announcement = await BroadcastAnnouncement.findOne({ announcement_id: announcementId }).lean();
  if (!announcement) {
    throw new NotFoundException(`Broadcast announcement '${announcementId}' not found`);
  }

  return {
    announcement_id: announcement.announcement_id,
    sender_id: announcement.sender_id,
    title: announcement.title,
    receipt_count: announcement.receipts.length,
    receipts: announcement.receipts
  };
}

export async function listBroadcasts(targetAudience) {
  const filter = {};
  if (targetAudience && targetAudience !== 'all') {
    filter.target_audience = { $in: ['all', targetAudience] };
  }
  const items = await BroadcastAnnouncement.find(filter).sort({ created_at: -1 }).lean();
  return items;
}
