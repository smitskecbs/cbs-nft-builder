import { STUDIO_DB_NAME, STUDIO_DB_VERSION } from '../collection/constants';
import { normalizeStudioDraft, normalizeStudioSettings, type StudioDraft, type StudioSettings } from './types';

export type StudioStore = {
  kind: 'indexeddb' | 'memory';
  putDraft(draft: StudioDraft): Promise<void>;
  getDrafts(collectionKey: string): Promise<StudioDraft[]>;
  deleteDraft(id: string): Promise<void>;
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | null>;
  deleteBlob(id: string): Promise<void>;
  putSettings(settings: StudioSettings): Promise<void>;
  getSettings(collectionKey: string): Promise<StudioSettings | null>;
};

const DRAFT_STORE = 'drafts';
const BLOB_STORE = 'artwork';
const SETTINGS_STORE = 'settings';

export function collectionStudioKey(
  network: 'devnet' | 'mainnet',
  collectionMint: string | null
): string {
  return collectionMint ? `${network}:${collectionMint}` : `${network}:pending`;
}

export function createMemoryStudioStore(
  seed?: {
    drafts?: StudioDraft[];
    blobs?: Map<string, Blob>;
    settings?: StudioSettings[];
  }
): StudioStore {
  const drafts = new Map<string, StudioDraft>(
    (seed?.drafts ?? []).map((draft) => [draft.id, draft])
  );
  const blobs = seed?.blobs ?? new Map<string, Blob>();
  const settings = new Map<string, StudioSettings>(
    (seed?.settings ?? []).map((item) => [item.collectionKey, item])
  );

  return {
    kind: 'memory',
    async putDraft(draft) {
      drafts.set(draft.id, draft);
    },
    async getDrafts(collectionKey) {
      return [...drafts.values()]
        .filter((draft) => draft.collectionKey === collectionKey)
        .map((draft) => normalizeStudioDraft(draft))
        .sort((a, b) => a.sortIndex - b.sortIndex || a.number - b.number);
    },
    async deleteDraft(id) {
      drafts.delete(id);
    },
    async putBlob(id, blob) {
      blobs.set(id, blob);
    },
    async getBlob(id) {
      return blobs.get(id) ?? null;
    },
    async deleteBlob(id) {
      blobs.delete(id);
    },
    async putSettings(value) {
      settings.set(value.collectionKey, value);
    },
    async getSettings(collectionKey) {
      const value = settings.get(collectionKey);
      return value ? normalizeStudioSettings(value) : null;
    },
  };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STUDIO_DB_NAME, STUDIO_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        const store = db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
        store.createIndex('collectionKey', 'collectionKey', { unique: false });
      }

      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'collectionKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB is unavailable.'));
  });
}

export function createIndexedDbStudioStore(): StudioStore {
  const withStore = async <T>(
    storeName: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> => {
    const db = await openStudioDb();

    try {
      const tx = db.transaction(storeName, mode);
      const complete = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
      });
      const result = await run(tx.objectStore(storeName));
      await complete;
      return result;
    } finally {
      db.close();
    }
  };

  return {
    kind: 'indexeddb',
    async putDraft(draft) {
      await withStore(DRAFT_STORE, 'readwrite', async (store) => {
        store.put(draft);
      });
    },
    async getDrafts(collectionKey) {
      return withStore(DRAFT_STORE, 'readonly', async (store) => {
        const index = store.index('collectionKey');
        const records = await requestToPromise(index.getAll(collectionKey));
        return (records as StudioDraft[])
          .map((draft) => normalizeStudioDraft(draft))
          .sort((a, b) => a.sortIndex - b.sortIndex || a.number - b.number);
      });
    },
    async deleteDraft(id) {
      await withStore(DRAFT_STORE, 'readwrite', async (store) => {
        store.delete(id);
      });
    },
    async putBlob(id, blob) {
      await withStore(BLOB_STORE, 'readwrite', async (store) => {
        store.put(blob, id);
      });
    },
    async getBlob(id) {
      return withStore(BLOB_STORE, 'readonly', async (store) => {
        const value = await requestToPromise(store.get(id));
        return value instanceof Blob ? value : null;
      });
    },
    async deleteBlob(id) {
      await withStore(BLOB_STORE, 'readwrite', async (store) => {
        store.delete(id);
      });
    },
    async putSettings(settings) {
      await withStore(SETTINGS_STORE, 'readwrite', async (store) => {
        store.put(settings);
      });
    },
    async getSettings(collectionKey) {
      return withStore(SETTINGS_STORE, 'readonly', async (store) => {
        const value = await requestToPromise(store.get(collectionKey));
        return normalizeStudioSettings(value);
      });
    },
  };
}

let sharedStore: StudioStore | null = null;

export function createStudioStore(): StudioStore {
  if (typeof indexedDB === 'undefined') {
    return createMemoryStudioStore();
  }

  return createIndexedDbStudioStore();
}

export function getSharedStudioStore(): StudioStore {
  if (!sharedStore) {
    sharedStore = createStudioStore();
  }

  return sharedStore;
}

export function setSharedStudioStoreForTests(store: StudioStore | null): void {
  sharedStore = store;
}
