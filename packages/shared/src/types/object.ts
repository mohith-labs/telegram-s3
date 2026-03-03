export interface ObjectInfo {
  id: string;
  key: string;
  bucketId: string;
  size: number;
  contentType: string;
  etag: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectListItem {
  key: string;
  size: number;
  contentType: string;
  etag: string;
  lastModified: string;
}

export interface FolderItem {
  prefix: string;
}

export interface ListObjectsResponse {
  objects: ObjectListItem[];
  folders: FolderItem[];
  isTruncated: boolean;
  nextContinuationToken?: string;
  keyCount: number;
}
