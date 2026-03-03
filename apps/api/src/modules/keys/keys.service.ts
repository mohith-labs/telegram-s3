import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class KeysService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const keys = await this.prisma.accessKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // Never return secretAccessKey in list
    return keys.map(({ secretAccessKey, ...key }) => ({
      ...key,
      permissions: JSON.parse(key.permissions),
    }));
  }

  async create(name: string, permissions?: Record<string, string[]>) {
    const accessKeyId = 'TGAK' + randomBytes(16).toString('hex').toUpperCase();
    const secretAccessKey = randomBytes(32).toString('base64url');

    const key = await this.prisma.accessKey.create({
      data: {
        name,
        accessKeyId,
        secretAccessKey,
        permissions: JSON.stringify(permissions || { '*': ['read', 'write', 'delete', 'list'] }),
      },
    });

    return {
      id: key.id,
      name: key.name,
      accessKeyId: key.accessKeyId,
      secretAccessKey, // Only returned on creation
    };
  }

  async update(id: string, data: { name?: string; isActive?: boolean; permissions?: Record<string, string[]> }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.permissions !== undefined) updateData.permissions = JSON.stringify(data.permissions);

    const key = await this.prisma.accessKey.update({
      where: { id },
      data: updateData,
    });

    const { secretAccessKey, ...rest } = key;
    return { ...rest, permissions: JSON.parse(rest.permissions) };
  }

  async delete(id: string) {
    await this.prisma.accessKey.delete({ where: { id } });
    return { deleted: true };
  }

  async findByAccessKeyId(accessKeyId: string) {
    return this.prisma.accessKey.findUnique({
      where: { accessKeyId },
    });
  }
}
