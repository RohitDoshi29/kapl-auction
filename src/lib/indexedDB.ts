import { logger } from '@/lib/logger';
import { PlayerRecord } from '@/lib/cricketTypes';

const DB_NAME = 'KAPL_3.0';
const DB_VERSION = 1;

interface AuctionSnapshot {
  id?: number;
  tournamentId: string;
  players: PlayerRecord[];
  teams: any[];
  timestamp: string;
  isCurrent: boolean;
}

let db: IDBDatabase | null = null;

export async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('IndexedDB open failed', new Error(request.error?.message));
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      logger.debug('IndexedDB initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains('auction_snapshots')) {
        const store = database.createObjectStore('auction_snapshots', { keyPath: 'id', autoIncrement: true });
        store.createIndex('tournamentId', 'tournamentId', { unique: false });
        store.createIndex('isCurrent', 'isCurrent', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function saveAuctionSnapshot(snapshot: Omit<AuctionSnapshot, 'id'>): Promise<void> {
  try {
    if (!db) {
      await initIndexedDB();
    }

    const transaction = db!.transaction(['auction_snapshots'], 'readwrite');
    const store = transaction.objectStore('auction_snapshots');

    // Mark previous current snapshot as not current
    const previousSnapshots = await new Promise<AuctionSnapshot[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as AuctionSnapshot[]) || []);
      request.onerror = () => reject(request.error);
    });

    for (const snap of previousSnapshots) {
      if (snap.isCurrent) {
        snap.isCurrent = false;
        store.put(snap);
      }
    }

    // Save new snapshot
    store.add(snapshot);

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    logger.debug('Auction snapshot saved', { tournamentId: snapshot.tournamentId });
  } catch (error) {
    logger.error('Failed to save auction snapshot', error);
    throw error;
  }
}

export async function getAuctionSnapshot(tournamentId: string): Promise<AuctionSnapshot | null> {
  try {
    if (!db) {
      await initIndexedDB();
    }

    const transaction = db!.transaction(['auction_snapshots'], 'readonly');
    const store = transaction.objectStore('auction_snapshots');
    const index = store.index('tournamentId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(tournamentId);
      request.onsuccess = () => {
        const snapshots = request.result as AuctionSnapshot[];
        const latest = snapshots.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        resolve(latest || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get auction snapshot', error);
    return null;
  }
}

export async function getCurrentAuctionSnapshot(): Promise<AuctionSnapshot | null> {
  try {
    if (!db) {
      await initIndexedDB();
    }

    const transaction = db!.transaction(['auction_snapshots'], 'readonly');
    const store = transaction.objectStore('auction_snapshots');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const snapshots = (request.result as AuctionSnapshot[]) || [];
        const current = snapshots
          .filter((s) => s.isCurrent)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        resolve(current || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get current auction snapshot', error);
    return null;
  }
}

export async function getAllAuctionSnapshots(tournamentId?: string): Promise<AuctionSnapshot[]> {
  try {
    if (!db) {
      await initIndexedDB();
    }

    const transaction = db!.transaction(['auction_snapshots'], 'readonly');
    const store = transaction.objectStore('auction_snapshots');

    return new Promise((resolve, reject) => {
      const request = tournamentId
        ? store.index('tournamentId').getAll(tournamentId)
        : store.getAll();

      request.onsuccess = () => {
        const snapshots = request.result as AuctionSnapshot[];
        resolve(snapshots.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get auction snapshots', error);
    return [];
  }
}

export async function deleteAuctionSnapshot(id: number): Promise<void> {
  try {
    if (!db) {
      await initIndexedDB();
    }

    const transaction = db!.transaction(['auction_snapshots'], 'readwrite');
    const store = transaction.objectStore('auction_snapshots');
    store.delete(id);

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    logger.debug('Auction snapshot deleted', { id });
  } catch (error) {
    logger.error('Failed to delete auction snapshot', error);
    throw error;
  }
}

export async function clearIndexedDB(): Promise<void> {
  try {
    if (!db) {
      await initIndexedDB();
    }

    const transaction = db!.transaction(['auction_snapshots'], 'readwrite');
    const store = transaction.objectStore('auction_snapshots');
    store.clear();

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    logger.debug('IndexedDB cleared');
  } catch (error) {
    logger.error('Failed to clear IndexedDB', error);
    throw error;
  }
}
