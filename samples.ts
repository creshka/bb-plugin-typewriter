export const sampleNames = ['key', 'key2', 'space', 'delete', 'enter'] as const;
export type SampleName = typeof sampleNames[number];
export type Sample = { name: SampleName; bytes: ArrayBuffer; size: number };
const MAX_FILE = 1024 * 1024;
const MAX_PACK = 4 * MAX_FILE;
const DB_NAME = 'bb-plugin-typewriter-local-sounds-v1';

export function validateWav(name: string, bytes: ArrayBuffer): Sample {
  const match = /^(key2?|space|delete|enter)\.wav$/i.exec(name);
  if (!match) throw new Error('Use key.wav, key2.wav, space.wav, delete.wav or enter.wav.');
  if (bytes.byteLength < 44 || bytes.byteLength > MAX_FILE) throw new Error(`${name}: WAV must be between 44 bytes and 1 MB.`);
  const u8 = new Uint8Array(bytes);
  const four = (at: number) => String.fromCharCode(...u8.slice(at, at + 4));
  if (four(0) !== 'RIFF' || four(8) !== 'WAVE') throw new Error(`${name}: invalid WAV header.`);
  return { name: match[1]!.toLowerCase() as SampleName, bytes, size: bytes.byteLength };
}

export async function readPack(files: File[], decode: (b: ArrayBuffer) => Promise<unknown>): Promise<Sample[]> {
  if (!files.length || files.length > 5) throw new Error('Choose one to five WAV files, including key.wav.');
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_PACK) throw new Error('Sound pack must be at most 4 MB.');
  const names = new Set<SampleName>();
  const result: Sample[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE) throw new Error(`${file.name}: file exceeds 1 MB.`);
    const sample = validateWav(file.name, await file.arrayBuffer());
    if (names.has(sample.name)) throw new Error(`Duplicate sound: ${sample.name}.`);
    names.add(sample.name);
    try { await decode(sample.bytes.slice(0)); }
    catch { throw new Error(`${file.name}: this browser cannot decode the audio.`); }
    result.push(sample);
  }
  if (!names.has('key')) throw new Error('Include key.wav for ordinary typing.');
  return result;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pack');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local sound storage is unavailable.'));
    request.onblocked = () => reject(new Error('Close other Typewriter settings tabs and try again.'));
  });
}

export async function loadPack(): Promise<Sample[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('pack', 'readonly');
      const request = tx.objectStore('pack').get('sounds');
      let result: Sample[] = [];
      request.onsuccess = () => {
        try {
          if (Array.isArray(request.result)) result = request.result.map((s: Sample) => validateWav(`${s.name}.wav`, s.bytes));
        } catch { result = []; }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(new Error('Could not read local sound pack.'));
      tx.onerror = () => reject(new Error('Could not read local sound pack.'));
    });
  } finally { db.close(); }
}

export async function savePack(samples: Sample[]): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pack', 'readwrite');
      tx.objectStore('pack').put(samples, 'sounds');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error('Could not save sound pack; previous pack kept.'));
      tx.onerror = () => reject(new Error('Could not save sound pack; previous pack kept.'));
    });
  } finally { db.close(); }
}
