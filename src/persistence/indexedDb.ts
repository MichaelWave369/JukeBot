import { initialRoomState } from "../core/reducer";
import type { Receipt, RoomState, Track } from "../core/types";

const DB_NAME = "jukebot";
const DB_VERSION = 1;
const MEDIA_STORE = "media";
const SESSION_STORE = "session";
const ACTIVE_SESSION = "active";

interface StoredMedia {
  id: string;
  title: string;
  artist?: string;
  tags?: string[];
  sourceType: Track["sourceType"];
  url?: string;
  blob?: Blob;
  addedAt?: string;
}

interface StoredSession {
  id: typeof ACTIVE_SESSION;
  state: RoomState;
  receipts: Receipt[];
  savedAt: string;
}

export interface RestoredSession {
  state: RoomState;
  receipts: Receipt[];
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Unable to open JukeBot IndexedDB"));
  });
}

function durableState(state: RoomState): RoomState {
  return {
    ...state,
    queue: [...state.queue],
    tracks: Object.fromEntries(
      Object.entries(state.tracks).map(([id, track]) => [
        id,
        {
          ...track,
          tags: track.tags ? [...track.tags] : undefined,
          source: track.sourceType === "local" ? `idb://${id}` : track.source,
        },
      ]),
    ),
  };
}

export class JukePersistence {
  private readonly dbPromise = openDatabase();

  async putLocalTrack(track: Track, file: Blob): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    const stored: StoredMedia = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      tags: track.tags ? [...track.tags] : undefined,
      sourceType: "local",
      blob: file,
      addedAt: track.addedAt,
    };
    tx.objectStore(MEDIA_STORE).put(stored);
    await transactionDone(tx);
  }

  async putUrlTrack(track: Track): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    const stored: StoredMedia = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      tags: track.tags ? [...track.tags] : undefined,
      sourceType: "url",
      url: track.source,
      addedAt: track.addedAt,
    };
    tx.objectStore(MEDIA_STORE).put(stored);
    await transactionDone(tx);
  }

  async removeTrack(trackId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    tx.objectStore(MEDIA_STORE).delete(trackId);
    await transactionDone(tx);
  }

  async saveSession(state: RoomState, receipts: Receipt[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const session: StoredSession = {
      id: ACTIVE_SESSION,
      state: durableState(state),
      receipts: receipts.slice(-1000),
      savedAt: new Date().toISOString(),
    };
    tx.objectStore(SESSION_STORE).put(session);
    await transactionDone(tx);
  }

  async restore(): Promise<RestoredSession> {
    const db = await this.dbPromise;

    const mediaTx = db.transaction(MEDIA_STORE, "readonly");
    const media = await request<StoredMedia[]>(mediaTx.objectStore(MEDIA_STORE).getAll());
    await transactionDone(mediaTx);

    const sessionTx = db.transaction(SESSION_STORE, "readonly");
    const saved = await request<StoredSession | undefined>(
      sessionTx.objectStore(SESSION_STORE).get(ACTIVE_SESSION),
    );
    await transactionDone(sessionTx);

    const tracks: Record<string, Track> = {};

    for (const stored of media) {
      let source: string | null = null;

      if (stored.sourceType === "local" && stored.blob) {
        source = URL.createObjectURL(stored.blob);
      } else if (stored.sourceType === "url" && stored.url) {
        source = stored.url;
      }

      if (!source) continue;

      tracks[stored.id] = {
        id: stored.id,
        title: stored.title,
        artist: stored.artist,
        tags: stored.tags ? [...stored.tags] : undefined,
        sourceType: stored.sourceType,
        source,
        addedAt: stored.addedAt,
      };
    }

    if (!saved) {
      return {
        state: {
          ...initialRoomState(),
          tracks,
        },
        receipts: [],
      };
    }

    const valid = new Set(Object.keys(tracks));
    const currentTrackId =
      saved.state.currentTrackId && valid.has(saved.state.currentTrackId)
        ? saved.state.currentTrackId
        : null;

    return {
      state: {
        ...saved.state,
        transport: "stopped",
        currentTrackId,
        queue: saved.state.queue.filter((trackId) => valid.has(trackId)),
        tracks,
      },
      receipts: saved.receipts ?? [],
    };
  }

  async countTracks(): Promise<number> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readonly");
    const count = await request<number>(tx.objectStore(MEDIA_STORE).count());
    await transactionDone(tx);
    return count;
  }
}
