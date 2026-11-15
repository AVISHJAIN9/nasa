// Plain IndexedDB offline queue for deep-space check-in persistence (F039)
// No external npm packages; native browser API with fallback.

export interface OfflineCheckInRecord {
  id: string; // Idempotency key
  crewId: string;
  timestamp: number;
  timeStr: string;
  type: 'mood' | 'pain' | 'vision' | 'dose' | 'general';
  summary: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'synced';
}

const DB_NAME = 'astrocare_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'checkin_queue';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {keyPath: 'id'});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// In-memory fallback if IndexedDB is disabled or unavailable
const memoryQueue: Map<string, OfflineCheckInRecord> = new Map();

export async function saveOfflineCheckIn(record: OfflineCheckInRecord): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    memoryQueue.set(record.id, record);
    try {
      localStorage.setItem('astrocare_fallback_queue', JSON.stringify(Array.from(memoryQueue.values())));
    } catch {
      // ignore
    }
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      memoryQueue.set(record.id, record);
      resolve();
    }
  });
}

export async function getOfflineCheckIns(): Promise<OfflineCheckInRecord[]> {
  const db = await openDatabase();
  if (!db) {
    try {
      const saved = localStorage.getItem('astrocare_fallback_queue');
      if (saved) {
        const parsed: OfflineCheckInRecord[] = JSON.parse(saved);
        parsed.forEach((r) => memoryQueue.set(r.id, r));
      }
    } catch {
      // ignore
    }
    return Array.from(memoryQueue.values());
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve(Array.from(memoryQueue.values()));
    }
  });
}

export async function removeOfflineCheckIn(id: string): Promise<void> {
  memoryQueue.delete(id);
  try {
    localStorage.setItem('astrocare_fallback_queue', JSON.stringify(Array.from(memoryQueue.values())));
  } catch {
    // ignore
  }

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllOfflineCheckIns(): Promise<void> {
  memoryQueue.clear();
  try {
    localStorage.removeItem('astrocare_fallback_queue');
  } catch {
    // ignore
  }

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
