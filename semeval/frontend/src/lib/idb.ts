import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface StoredAudioChunk {
  id: string; // recordingId:seq
  recordingId: string;
  seq: number;
  blob: Blob;
  sha256: string;
  byteSize: number;
  createdAt: number;
  uploaded: boolean;
  gapBeforeMs?: number;
}

interface SemevalDB extends DBSchema {
  audioChunks: {
    key: string;
    value: StoredAudioChunk;
    indexes: { "by-recording": string; "by-uploaded": number };
  };
}

let dbPromise: Promise<IDBPDatabase<SemevalDB>> | null = null;

export function getAudioDB(): Promise<IDBPDatabase<SemevalDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SemevalDB>("semeval-audio-db", 1, {
      upgrade(db) {
        const store = db.createObjectStore("audioChunks", { keyPath: "id" });
        store.createIndex("by-recording", "recordingId");
        store.createIndex("by-uploaded", "uploaded");
      },
    });
  }
  return dbPromise;
}

export async function saveAudioChunk(chunk: StoredAudioChunk): Promise<void> {
  const db = await getAudioDB();
  await db.put("audioChunks", chunk);
}

export async function getPendingChunks(recordingId: string): Promise<StoredAudioChunk[]> {
  const db = await getAudioDB();
  const chunks = await db.getAllFromIndex("audioChunks", "by-recording", recordingId);
  return chunks.filter((c) => !c.uploaded).sort((a, b) => a.seq - b.seq);
}

export async function markChunkUploaded(id: string): Promise<void> {
  const db = await getAudioDB();
  const chunk = await db.get("audioChunks", id);
  if (chunk) {
    chunk.uploaded = true;
    await db.put("audioChunks", chunk);
  }
}

export async function clearRecordingChunks(recordingId: string): Promise<void> {
  const db = await getAudioDB();
  const tx = db.transaction("audioChunks", "readwrite");
  const index = tx.store.index("by-recording");
  let cursor = await index.openCursor(recordingId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
