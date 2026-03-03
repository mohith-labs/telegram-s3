import { createHmac, createHash } from 'crypto';
import { S3_REGION, S3_SERVICE } from '@tgs3/shared';

export interface ParsedAuth {
  accessKeyId: string;
  dateStamp: string;
  region: string;
  service: string;
  signedHeaders: string[];
  signature: string;
}

export function parseAuthorizationHeader(header: string): ParsedAuth | null {
  // AWS4-HMAC-SHA256 Credential=AKID/20260303/us-east-1/s3/aws4_request,
  // SignedHeaders=host;x-amz-content-sha256;x-amz-date,
  // Signature=abcdef
  const match = header.match(
    /^AWS4-HMAC-SHA256\s+Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request,\s*SignedHeaders=([^,]+),\s*Signature=([a-f0-9]+)$/,
  );
  if (!match) return null;

  return {
    accessKeyId: match[1],
    dateStamp: match[2],
    region: match[3],
    service: match[4],
    signedHeaders: match[5].split(';'),
    signature: match[6],
  };
}

export interface ParsedPresigned {
  accessKeyId: string;
  dateStamp: string;
  region: string;
  service: string;
  signedHeaders: string[];
  signature: string;
  expires: number;
  date: string;
}

export function parsePresignedQuery(query: Record<string, string>): ParsedPresigned | null {
  const algorithm = query['X-Amz-Algorithm'];
  const credential = query['X-Amz-Credential'];
  const date = query['X-Amz-Date'];
  const expires = query['X-Amz-Expires'];
  const signedHeaders = query['X-Amz-SignedHeaders'];
  const signature = query['X-Amz-Signature'];

  if (!algorithm || !credential || !date || !expires || !signedHeaders || !signature) {
    return null;
  }

  const credParts = credential.split('/');
  if (credParts.length !== 5) return null;

  return {
    accessKeyId: credParts[0],
    dateStamp: credParts[1],
    region: credParts[2],
    service: credParts[3],
    signedHeaders: signedHeaders.split(';'),
    signature,
    expires: parseInt(expires),
    date,
  };
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

export function verifySignature(params: {
  method: string;
  path: string;
  queryString: string;
  headers: Record<string, string>;
  signedHeaders: string[];
  payloadHash: string;
  secretAccessKey: string;
  dateStamp: string;
  amzDate: string;
  region: string;
  service: string;
  expectedSignature: string;
}): boolean {
  // Build canonical request
  const canonicalHeaders = params.signedHeaders
    .map((h) => `${h}:${(params.headers[h] || '').trim()}`)
    .join('\n');

  const canonicalRequest = [
    params.method,
    params.path,
    params.queryString,
    canonicalHeaders + '\n',
    params.signedHeaders.join(';'),
    params.payloadHash,
  ].join('\n');

  // Build string to sign
  const credentialScope = `${params.dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    params.amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  // Calculate signature
  const signingKey = deriveSigningKey(
    params.secretAccessKey,
    params.dateStamp,
    params.region,
    params.service,
  );
  const calculatedSignature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  return calculatedSignature === params.expectedSignature;
}
