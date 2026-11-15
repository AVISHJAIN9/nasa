/**
 * AstroCare Frontend-to-Backend Sync Bridge
 *
 * Implements the required sync architecture:
 * 1. Optimistic local write -> write-through to backend -> poll hydrate -> merge by stable ID
 * 2. Fail-safe: keeps local state on network error; retries failed writes on next poll
 * 3. No echo of remote data (`applyingRemote` flag guard)
 * 4. Alert status monotonic progression: only moves forward (new -> ack -> resolved)
 * 5. Respects mock mode (offline demo when VITE_USE_MOCKS !== 'false')
 */

import { api } from './client';
import type { Alert, CheckIn, CrewOrder, BroadcastMessage, Message, MissionMode } from '../store';

// Dynamic store accessor avoiding circular type inference cycle
function getStore() {
  if (typeof window !== 'undefined' && (window as unknown as { useStore: { getState: () => any; setState: (s: any) => void } }).useStore) {
    return (window as unknown as { useStore: { getState: () => any; setState: (s: any) => void } }).useStore;
  }
  return null;
}

let applyingRemote = false;
const retryQueue: Array<() => Promise<void>> = [];

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return true;
  return import.meta.env.VITE_USE_MOCKS !== 'false';
}

// Monotonic progression for alert status: new (1) -> ack (2) -> resolved (3)
const ALERT_STATUS_PRECEDENCE: Record<string, number> = {
  new: 1,
  active: 1,
  ack: 2,
  acknowledged: 2,
  snoozed: 2,
  resolved: 3
};

export function canUpdateAlertStatus(currentStatus: string, incomingStatus: string): boolean {
  const currentRank = ALERT_STATUS_PRECEDENCE[currentStatus.toLowerCase()] || 1;
  const incomingRank = ALERT_STATUS_PRECEDENCE[incomingStatus.toLowerCase()] || 1;
  return incomingRank >= currentRank;
}

// -------------------------------------------------------------
// Write-Through Sync Functions
// -------------------------------------------------------------

export async function bridgeCreateAlert(alert: Alert): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post('/alerts', {
      id: alert.id,
      alert_id: alert.id,
      crew_id: alert.crewId || 'vega',
      source: alert.source,
      severity: alert.severity,
      title: alert.title,
      message: alert.explanation,
      status: alert.status,
      timestamp: alert.timestamp,
      factors: alert.factors,
      confidence: alert.confidence
    });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Alert create write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeAcknowledgeAlert(id: string, ackBy = 'operator'): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post(`/alerts/${encodeURIComponent(id)}/acknowledge`, { acknowledged_by: ackBy });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Alert ack write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeResolveAlert(id: string, notes = 'Resolved via clinical action', resolvedBy = 'operator'): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post(`/alerts/${encodeURIComponent(id)}/resolve`, { notes, resolved_by: resolvedBy });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Alert resolve write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeSaveCheckIn(checkIn: CheckIn): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post('/checkins', {
      id: checkIn.id,
      checkin_id: checkIn.id,
      crew_id: checkIn.crewId,
      mood: checkIn.mood,
      energy: checkIn.energy,
      pain: checkIn.pain,
      symptoms: checkIn.symptoms,
      timestamp: checkIn.timestamp,
      status: 'synced'
    });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Check-in write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeSaveSoapNote(
  crewId: string,
  author: string,
  subjective: string,
  objective: string,
  assessment: string,
  plan: string,
  id?: string
): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const noteId = id || `note-${crewId}-${Date.now()}`;
  const task = async () => {
    await api.post('/notes', {
      id: noteId,
      note_id: noteId,
      crew_id: crewId,
      author_name: author,
      subjective,
      objective,
      assessment,
      plan,
      timestamp: Date.now()
    });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] SOAP note write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeSaveOrder(order: CrewOrder): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post('/orders', order);
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Order write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeSaveBroadcast(broadcast: BroadcastMessage): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post('/broadcasts', broadcast);
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Broadcast write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeSaveConsultMessage(message: Message): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.post('/consults', {
      message_id: message.id,
      sender_id: message.from === 'crew' ? 'vega' : 'ground_control',
      subject: message.kind.toUpperCase(),
      body: message.text,
      direction: message.from === 'crew' ? 'space_to_ground' : 'ground_to_space'
    });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Consult message write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

export async function bridgeSetMissionMode(mode: MissionMode): Promise<void> {
  if (isMockMode() || applyingRemote) return;

  const task = async () => {
    await api.put('/mission-config', { mode });
  };

  try {
    await task();
  } catch (err) {
    console.warn('[Bridge] Mission mode write-through failed, queuing for retry:', err);
    retryQueue.push(task);
  }
}

// -------------------------------------------------------------
// Poll Hydrate & Merge by Stable ID
// -------------------------------------------------------------

export async function pollHydrate(): Promise<void> {
  if (isMockMode()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

  // 1. Flush any queued retries first
  if (retryQueue.length > 0) {
    const queueSnapshot = [...retryQueue];
    retryQueue.length = 0;
    for (const task of queueSnapshot) {
      try {
        await task();
      } catch {
        retryQueue.push(task);
      }
    }
  }

  // 2. Fetch remote entities in parallel (fail-safe)
  try {
    const [alertsRes, checkInsRes, notesRes, ordersRes, broadcastsRes] = await Promise.allSettled([
      api.get<{ alerts: Record<string, unknown>[] }>('/alerts/inbox'),
      api.get<Record<string, unknown>[]>('/checkins'),
      api.get<Record<string, unknown>[]>('/notes'),
      api.get<CrewOrder[]>('/orders'),
      api.get<BroadcastMessage[]>('/broadcasts')
    ]);

    applyingRemote = true;
    const storeApi = getStore();
    if (!storeApi) return;
    const store = storeApi.getState();

    // Merge Alerts
    if (alertsRes.status === 'fulfilled' && alertsRes.value) {
      const remoteAlerts = alertsRes.value.alerts || (Array.isArray(alertsRes.value) ? alertsRes.value : []);
      if (Array.isArray(remoteAlerts) && remoteAlerts.length > 0) {
        const mergedAlerts = [...store.alerts];
        for (const ra of remoteAlerts) {
          const remoteId = String(ra.alert_id || ra.id);
          const rawStatus = String(ra.status || 'new').toLowerCase();
          const remoteStatus = rawStatus === 'active' ? 'new' : rawStatus === 'acknowledged' ? 'ack' : (rawStatus as 'new' | 'ack' | 'resolved');
          const existingIdx = mergedAlerts.findIndex((a: Alert) => a.id === remoteId);

          if (existingIdx >= 0) {
            const current = mergedAlerts[existingIdx];
            if (canUpdateAlertStatus(current.status, remoteStatus)) {
              mergedAlerts[existingIdx] = {
                ...current,
                status: remoteStatus,
                severity: String(ra.severity || current.severity).toLowerCase() as Alert['severity']
              };
            }
          } else {
            mergedAlerts.push({
              id: remoteId,
              time: ra.created_at ? new Date(ra.created_at as string).toLocaleTimeString() : 'now',
              timestamp: ra.created_at ? new Date(ra.created_at as string).getTime() : Date.now(),
              crewId: (ra.crew_id as string) || 'vega',
              source: (ra.source as Alert['source']) || 'RULE',
              severity: String(ra.severity || 'watch').toLowerCase() as Alert['severity'],
              title: (ra.title as string) || 'Clinical Alert',
              explanation: (ra.message as string) || '',
              factors: (ra.metadata as Record<string, unknown>)?.factors as Alert['factors'] || [],
              confidence: (ra.metadata as Record<string, unknown>)?.confidence as number || 0.9,
              status: remoteStatus,
              count: 1
            });
          }
        }
        storeApi.setState({ alerts: mergedAlerts });
      }
    }

    // Merge Check-ins
    if (checkInsRes.status === 'fulfilled' && Array.isArray(checkInsRes.value)) {
      const remoteCheckIns = checkInsRes.value;
      if (remoteCheckIns.length > 0) {
        const mergedCheckIns = [...store.checkIns];
        for (const rc of remoteCheckIns) {
          const id = String(rc.checkin_id || rc.id);
          const existingIdx = mergedCheckIns.findIndex((c: CheckIn) => c.id === id);
          const mapped: CheckIn = {
            id,
            crewId: String(rc.crew_id || 'vega'),
            time: rc.timestamp ? new Date(rc.timestamp as string).toLocaleTimeString() : 'now',
            timestamp: rc.timestamp ? new Date(rc.timestamp as string).getTime() : Date.now(),
            mood: Number(rc.mood ?? 3),
            energy: Number(rc.energy ?? 3),
            pain: Number(rc.pain ?? 0),
            symptoms: (rc.symptoms as string[]) || [],
            status: 'synced'
          };
          if (existingIdx >= 0) {
            mergedCheckIns[existingIdx] = mapped;
          } else {
            mergedCheckIns.unshift(mapped);
          }
        }
        storeApi.setState({ checkIns: mergedCheckIns });
      }
    }

    // Merge Orders
    if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
      if (ordersRes.value.length > 0) {
        storeApi.setState({ orders: ordersRes.value });
      }
    }

    // Merge Broadcasts
    if (broadcastsRes.status === 'fulfilled' && Array.isArray(broadcastsRes.value)) {
      if (broadcastsRes.value.length > 0) {
        storeApi.setState({ broadcasts: broadcastsRes.value });
      }
    }
  } catch (err) {
    console.warn('[Bridge] Hydration poll error (fail-safe local retained):', err);
  } finally {
    applyingRemote = false;
  }
}

// Global Poll Timer
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startBridgeSync(pollIntervalMs = 5000): void {
  if (typeof window === 'undefined' || isMockMode()) return;
  if (pollTimer) clearInterval(pollTimer);

  // Initial immediate poll
  pollHydrate();

  pollTimer = setInterval(() => {
    pollHydrate();
  }, pollIntervalMs);
}

export function stopBridgeSync(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
