export const CHANNEL_PREFIX = 'tgs3';
export const CHUNK_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
export const UPLOAD_WORKERS = 4;

export function channelTitle(bucketName: string): string {
  return `${CHANNEL_PREFIX}::${bucketName}`;
}

export function bucketNameFromChannel(title: string): string | null {
  if (!title.startsWith(`${CHANNEL_PREFIX}::`)) return null;
  return title.slice(CHANNEL_PREFIX.length + 2);
}
