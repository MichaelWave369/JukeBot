import { initialRoomState } from "../core/reducer";
import type { JukeBundle } from "../core/bundle";
import type {
  Playlist,
  Receipt,
  RoomState,
  Track,
  TrackMetadataPatch,
} from "../core/types";

const DB_NAME = "jukebot";
const DB_VERSION = 2;
const MEDIA_STORE = "media";
const SESSION_STORE = "session";
const PLAYLIST_STORE = "playlists";
const ACTIVE_SESSION = "active";

interface StoredMedia {
  id: string;
  title: string;
  artist?: string;
  tags?: string[];
  coverUrl?: string;
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
  playlists: Playlist[];
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
      if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
        db.createObjectStore(PLAYLIST_STORE, { keyPath: "id" });
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

function storedToTrack(stored: StoredMedia): Track | null {
  let source: string | null = null;

  if (stored.sourceType === "local" && stored.blob) {
    source = URL.createObjectURL(stored.blob);
  } else if (stored.sourceType === "url" && stored.url) {
    source = stored.url;
  }

  if (!source) return null;

  return {
    id: stored.id,
    title: stored.title,
    artist: stored.artist,
    tags: stored.tags ? [...stored.tags] : undefined,
    coverUrl: stored.coverUrl,
    sourceType: stored.sourceType,
    source,
    addedAt: stored.addedAt,
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
      coverUrl: track.coverUrl,
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
      coverUrl: track.coverUrl,
      sourceType: "url",
      url: track.source,
      addedAt: track.addedAt,
    };
    tx.objectStore(MEDIA_STORE).put(stored);
    await transactionDone(tx);
  }

  async updateTrackMetadata(trackId: string, patch: TrackMetadataPatch): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readwrite");
    const store = tx.objectStore(MEDIA_STORE);
    const existing = await request<StoredMedia | undefined>(store.get(trackId));
    if (!existing) {
      tx.abort();
      throw new Error("Track is not present in persistent media");
    }

    store.put({
      ...existing,
      ...patch,
      tags: patch.tags ? [...patch.tags] : existing.tags,
    } satisfies StoredMedia);
    await transactionDone(tx);
  }

  async removeTrack(trackId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction([MEDIA_STORE, PLAYLIST_STORE], "readwrite");
    tx.objectStore(MEDIA_STORE).delete(trackId);

    const playlistStore = tx.objectStore(PLAYLIST_STORE);
    const playlists = await request<Playlist[]>(playlistStore.getAll());
    for (const playlist of playlists) {
      if (!playlist.trackIds.includes(trackId)) continue;
      playlistStore.put({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId),
        updatedAt: new Date().toISOString(),
      });
    }

    await transactionDone(tx);
  }

  async hasTrack(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readonly");
    const count = await request<number>(tx.objectStore(MEDIA_STORE).count(trackId));
    await transactionDone(tx);
    return count > 0;
  }

  async trackIds(): Promise<string[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(MEDIA_STORE, "readonly");
    const keys = await request<IDBValidKey[]>(tx.objectStore(MEDIA_STORE).getAllKeys());
    await transactionDone(tx);
    return keys.map(String);
  }

  async savePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(PLAYLIST_STORE, "readwrite");
    tx.objectStore(PLAYLIST_STORE).put({
      ...playlist,
      trackIds: [...playlist.trackIds],
    });
    await transactionDone(tx);
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(PLAYLIST_STORE, "readwrite");
    tx.objectStore(PLAYLIST_STORE).delete(playlistId);
    await transactionDone(tx);
  }

  async listPlaylists(): Promise<Playlist[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(PLAYLIST_STORE, "readonly");
    const playlists = await request<Playlist[]>(tx.objectStore(PLAYLIST_STORE).getAll());
    await transactionDone(tx);
    return playlists
      .map((playlist) => ({ ...playlist, trackIds: [...playlist.trackIds] }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

  async importBundle(bundle: JukeBundle): Promise<{ missingLocalTrackIds: string[] }> {
    const availableBefore = new Set(await this.trackIds());
    const missingLocalTrackIds: string[] = [];

    for (const entry of bundle.media) {
      if (entry.sourceType === "url" && entry.url) {
        await this.putUrlTrack({
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          tags: entry.tags ? [...entry.tags] : undefined,
          coverUrl: entry.coverUrl,
          sourceType: "url",
          source: entry.url,
        });
        continue;
      }

      if (entry.sourceType === "local") {
        if (!availableBefore.has(entry.id)) {
          missingLocalTrackIds.push(entry.id);
        } else {
          await this.updateTrackMetadata(entry.id, {
            title: entry.title,
            artist: entry.artist,
            tags: entry.tags ? [...entry.tags] : undefined,
            coverUrl: entry.coverUrl,
          });
        }
      }
    }

    for (const playlist of bundle.playlists ?? []) {
      await this.savePlaylist(playlist);
    }

    await this.saveSession(bundle.room, bundle.receipts);
    return { missingLocalTrackIds };
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
      const track = storedToTrack(stored);
      if (track) tracks[track.id] = track;
    }

    const playlists = await this.listPlaylists();

    if (!saved) {
      return {
        state: {
          ...initialRoomState(),
          tracks,
        },
        receipts: [],
        playlists,
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
      playlists,
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
