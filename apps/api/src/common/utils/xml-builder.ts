import { S3_XML_NAMESPACE } from '@tgs3/shared';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildListBucketsXml(
  buckets: { name: string; createdAt: Date }[],
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="${S3_XML_NAMESPACE}">
  <Owner>
    <ID>tgs3</ID>
    <DisplayName>Telegram S3</DisplayName>
  </Owner>
  <Buckets>
    ${buckets
      .map(
        (b) =>
          `<Bucket><Name>${escapeXml(b.name)}</Name><CreationDate>${b.createdAt.toISOString()}</CreationDate></Bucket>`,
      )
      .join('\n    ')}
  </Buckets>
</ListAllMyBucketsResult>`;
}

export function buildListObjectsV2Xml(params: {
  bucketName: string;
  prefix: string;
  delimiter: string;
  maxKeys: number;
  keyCount: number;
  isTruncated: boolean;
  nextContinuationToken?: string;
  contents: {
    key: string;
    lastModified: Date;
    etag: string;
    size: bigint;
    storageClass: string;
  }[];
  commonPrefixes: string[];
}): string {
  const contentsXml = params.contents
    .map(
      (obj) => `  <Contents>
    <Key>${escapeXml(obj.key)}</Key>
    <LastModified>${obj.lastModified.toISOString()}</LastModified>
    <ETag>"${obj.etag}"</ETag>
    <Size>${obj.size}</Size>
    <StorageClass>${obj.storageClass}</StorageClass>
  </Contents>`,
    )
    .join('\n  ');

  const prefixesXml = params.commonPrefixes
    .map((p) => `  <CommonPrefixes><Prefix>${escapeXml(p)}</Prefix></CommonPrefixes>`)
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="${S3_XML_NAMESPACE}">
  <Name>${escapeXml(params.bucketName)}</Name>
  <Prefix>${escapeXml(params.prefix)}</Prefix>
  <Delimiter>${escapeXml(params.delimiter)}</Delimiter>
  <KeyCount>${params.keyCount}</KeyCount>
  <MaxKeys>${params.maxKeys}</MaxKeys>
  <IsTruncated>${params.isTruncated}</IsTruncated>
  ${contentsXml}
  ${prefixesXml}
  ${params.nextContinuationToken ? `<NextContinuationToken>${params.nextContinuationToken}</NextContinuationToken>` : ''}
</ListBucketResult>`;
}

export function buildErrorXml(
  code: string,
  message: string,
  resource: string,
  requestId: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>${code}</Code>
  <Message>${escapeXml(message)}</Message>
  <Resource>${escapeXml(resource)}</Resource>
  <RequestId>${requestId}</RequestId>
</Error>`;
}

export function buildCopyObjectResultXml(
  etag: string,
  lastModified: Date,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult>
  <ETag>"${etag}"</ETag>
  <LastModified>${lastModified.toISOString()}</LastModified>
</CopyObjectResult>`;
}

export function buildInitiateMultipartUploadXml(
  bucket: string,
  key: string,
  uploadId: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<InitiateMultipartUploadResult xmlns="${S3_XML_NAMESPACE}">
  <Bucket>${escapeXml(bucket)}</Bucket>
  <Key>${escapeXml(key)}</Key>
  <UploadId>${uploadId}</UploadId>
</InitiateMultipartUploadResult>`;
}

export function buildCompleteMultipartUploadXml(
  bucket: string,
  key: string,
  etag: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUploadResult xmlns="${S3_XML_NAMESPACE}">
  <Location>/${escapeXml(bucket)}/${escapeXml(key)}</Location>
  <Bucket>${escapeXml(bucket)}</Bucket>
  <Key>${escapeXml(key)}</Key>
  <ETag>"${etag}"</ETag>
</CompleteMultipartUploadResult>`;
}

export function buildListPartsXml(params: {
  bucket: string;
  key: string;
  uploadId: string;
  parts: { partNumber: number; etag: string; size: bigint; lastModified: Date }[];
}): string {
  const partsXml = params.parts
    .map(
      (p) => `  <Part>
    <PartNumber>${p.partNumber}</PartNumber>
    <ETag>"${p.etag}"</ETag>
    <Size>${p.size}</Size>
    <LastModified>${p.lastModified.toISOString()}</LastModified>
  </Part>`,
    )
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListPartsResult xmlns="${S3_XML_NAMESPACE}">
  <Bucket>${escapeXml(params.bucket)}</Bucket>
  <Key>${escapeXml(params.key)}</Key>
  <UploadId>${params.uploadId}</UploadId>
  ${partsXml}
</ListPartsResult>`;
}
