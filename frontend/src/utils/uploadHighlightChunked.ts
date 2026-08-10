/**
 * uploadHighlightChunked — Reliable highlight reel upload for large files
 * (30–80 MB clips that frequently exceed proxy multipart limits).
 *
 * Protocol:
 *   1. POST /trainer-profiles/{userId}/highlights/chunked/init  → uploadId
 *   2. For each 2 MB slice: POST .../append with base64 chunk
 *   3. POST .../commit to reassemble + persist
 *   4. (Optional) DELETE .../{uploadId} if user cancels mid-upload
 *
 * Returns the same `highlight` payload as the single-shot endpoint so callers
 * can drop it straight into local state.
 */
import api from '../services/api';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB — must not exceed backend CHUNK_MAX_BYTES

export interface ChunkedUploadOptions {
  userId: string;
  uri: string;              // local file:// URI from expo-image-picker
  filename: string;
  contentType?: string;
  caption?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;     // honor user cancellation
}

const toBase64 = (bytes: Uint8Array): string => {
  // RN-safe base64 (avoids btoa polyfill issues on Android)
  let binary = '';
  const len = bytes.byteLength;
  // Use chunked join to dodge "Maximum call stack" for large arrays
  const STEP = 0x8000;
  for (let i = 0; i < len; i += STEP) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + STEP)) as any);
  }
  // global.btoa is available on Hermes/Web
  // eslint-disable-next-line no-undef
  return (globalThis as any).btoa ? (globalThis as any).btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
};

export async function uploadHighlightChunked({
  userId, uri, filename, contentType, caption, onProgress, signal,
}: ChunkedUploadOptions): Promise<{ success: boolean; highlight: any; uploadedBytes: number }> {
  // 1. Fetch the file bytes via fetch (works for file://, content://, http://)
  const resp = await fetch(uri);
  const blob = await resp.blob();
  const totalBytes = blob.size;
  if (totalBytes === 0) throw new Error('Empty file');

  // 2. Init
  const initResp = await api.post(
    `/trainer-profiles/${userId}/highlights/chunked/init`,
    { filename, contentType: contentType || blob.type || 'application/octet-stream', totalBytes, caption: caption || '' },
  );
  const uploadId: string = initResp.data.uploadId;
  if (!uploadId) throw new Error('init failed: no uploadId');

  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  // 3. Append chunks with bounded concurrency (iter118w). Sequential uploads
  // were the primary bottleneck on 30-80MB clips — with 3-way concurrency
  // on a decent 4G/wifi connection the total upload time drops ~3×.
  // Kept at 3 (not higher) because RN/Android chokes on many parallel
  // large base64 POSTs and mobile carrier proxies frequently rate-limit.
  const arrayBuffer = await blob.arrayBuffer();
  const view = new Uint8Array(arrayBuffer);
  const CONCURRENCY = 3;
  let completed = 0;
  let cancelled = false;

  const uploadChunk = async (i: number) => {
    if (cancelled || signal?.aborted) {
      cancelled = true;
      throw new Error('Upload cancelled');
    }
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const slice = view.subarray(start, end);
    const dataBase64 = toBase64(slice);
    await api.post(`/trainer-profiles/${userId}/highlights/chunked/append`, {
      uploadId,
      chunkIndex: i,
      dataBase64,
    });
    completed += 1;
    if (onProgress) onProgress(Math.round((completed / totalChunks) * 95));
  };

  // Simple worker pool — feed chunk indices to N concurrent uploaders.
  const queue = Array.from({ length: totalChunks }, (_, i) => i);
  const workers = Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) break;
      await uploadChunk(next);
    }
  });

  try {
    await Promise.all(workers);
  } catch (e) {
    cancelled = true;
    await api.delete(`/trainer-profiles/${userId}/highlights/chunked/${uploadId}`).catch(() => {});
    throw e;
  }

  // 4. Commit
  const commit = await api.post(
    `/trainer-profiles/${userId}/highlights/chunked/commit`,
    { uploadId, totalChunks },
  );
  if (onProgress) onProgress(100);
  return commit.data;
}
