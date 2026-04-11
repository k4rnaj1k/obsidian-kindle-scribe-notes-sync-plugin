const DB_NAME = 'kindle-scribe-downloads';
const STORE_NAME = 'downloads';
const DB_VERSION = 1;

export type DownloadRecord = {
    id: string;
    title: string;
    downloadedAt: number;     // Date.now() at time of download
    contentHash: string;      // SHA-256 hex digest of raw TAR bytes
    modificationTime: number; // metadata.modificationTime from Amazon API (stored as-is)
};

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error(req.error?.message ?? 'Failed to open IndexedDB'));
    });
}

export async function recordDownload(record: DownloadRecord): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(new Error(tx.error?.message ?? 'Failed to write to IndexedDB')); };
    });
}

export async function getRecord(id: string): Promise<DownloadRecord | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => { db.close(); resolve(req.result as DownloadRecord | undefined); };
        req.onerror = () => { db.close(); reject(new Error(req.error?.message ?? 'Failed to read from IndexedDB')); };
    });
}

export async function getAllRecords(): Promise<Map<string, DownloadRecord>> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
            db.close();
            const map = new Map<string, DownloadRecord>();
            (req.result as DownloadRecord[]).forEach(r => map.set(r.id, r));
            resolve(map);
        };
        req.onerror = () => { db.close(); reject(new Error(req.error?.message ?? 'Failed to read all records from IndexedDB')); };
    });
}

/** Normalize a timestamp to milliseconds.
 *  Amazon APIs may return seconds (< 1e10) or milliseconds (>= 1e10). */
export const toMs = (t: number): number => (t > 1e10 ? t : t * 1000);

/** Compute a SHA-256 hex digest over an array of ArrayBuffers. */
export async function computeHash(buffers: ArrayBuffer[]): Promise<string> {
    const totalBytes = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const buf of buffers) {
        merged.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
    }
    const hashBuf = await crypto.subtle.digest('SHA-256', merged);
    return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export const downloadStore = { recordDownload, getRecord, getAllRecords };
