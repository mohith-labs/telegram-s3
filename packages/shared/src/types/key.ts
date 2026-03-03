export interface AccessKeyInfo {
  id: string;
  name: string;
  accessKeyId: string;
  isActive: boolean;
  permissions: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKeyDto {
  name: string;
  permissions?: Record<string, string[]>;
}

export interface CreateKeyResponse {
  id: string;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
}
