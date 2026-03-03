export interface BucketInfo {
  id: string;
  name: string;
  channelId: string;
  objectCount?: number;
  totalSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBucketDto {
  name: string;
}
