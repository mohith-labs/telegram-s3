import { createHash } from 'crypto';

export function computeEtag(data: Buffer): string {
  return createHash('md5').update(data).digest('hex');
}

export function computeMultipartEtag(partEtags: string[]): string {
  const hash = createHash('md5');
  for (const etag of partEtags) {
    hash.update(Buffer.from(etag, 'hex'));
  }
  return `${hash.digest('hex')}-${partEtags.length}`;
}
