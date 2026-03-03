import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { computeCheck } from 'telegram/Password';
import bigInt from 'big-integer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UPLOAD_WORKERS, channelTitle } from '@tgs3/shared';

@Injectable()
export class TelegramService implements OnModuleInit {
  private client: TelegramClient | null = null;
  private logger = new Logger(TelegramService.name);
  private phoneCodeHash: string | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.restoreSession();
  }

  private async restoreSession(): Promise<boolean> {
    const session = await this.prisma.telegramSession.findFirst();
    if (session && session.sessionString) {
      try {
        this.client = new TelegramClient(
          new StringSession(session.sessionString),
          session.apiId,
          session.apiHash,
          { connectionRetries: 5 },
        );
        await this.client.connect();
        if (await this.client.isUserAuthorized()) {
          this.logger.log('Telegram session restored successfully');
          await this.prisma.telegramSession.update({
            where: { id: session.id },
            data: { connected: true },
          });
          return true;
        } else {
          this.logger.warn('Saved session is no longer authorized');
          this.client = null;
        }
      } catch (error) {
        this.logger.error('Failed to restore Telegram session', error);
        this.client = null;
      }
    }
    return false;
  }

  async getStatus() {
    if (!this.client) {
      return { connected: false };
    }

    try {
      const me = await this.client.getMe();
      return {
        connected: true,
        phoneNumber: (me as any).phone,
        username: (me as any).username,
        firstName: (me as any).firstName,
        lastName: (me as any).lastName,
      };
    } catch {
      return { connected: false };
    }
  }

  async sendCode(apiId: number, apiHash: string, phoneNumber: string) {
    this.client = new TelegramClient(
      new StringSession(''),
      apiId,
      apiHash,
      { connectionRetries: 5 },
    );
    await this.client.connect();

    const result = await this.client.sendCode(
      { apiId, apiHash },
      phoneNumber,
    );
    this.phoneCodeHash = result.phoneCodeHash;

    // Save API credentials
    await this.prisma.telegramSession.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        apiId,
        apiHash,
        phoneNumber,
        sessionString: '',
        connected: false,
      },
      update: { apiId, apiHash, phoneNumber },
    });

    return { phoneCodeHash: result.phoneCodeHash };
  }

  async verifyCode(phoneNumber: string, code: string, phoneCodeHash: string) {
    if (!this.client) {
      throw new Error('Client not initialized. Send code first.');
    }

    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        }),
      );

      // Save session
      const sessionString = (this.client.session as StringSession).save();
      await this.prisma.telegramSession.update({
        where: { id: 'default' },
        data: { sessionString, connected: true },
      });

      return { success: true };
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        return { success: false, need2FA: true };
      }
      throw error;
    }
  }

  async verify2FA(password: string) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const passwordResult = await this.client.invoke(
      new Api.account.GetPassword(),
    );
    const passwordSrp = await computeCheck(passwordResult, password);
    const authResult = await this.client.invoke(
      new Api.auth.CheckPassword({
        password: passwordSrp,
      }),
    );

    // Save session
    const sessionString = (this.client.session as StringSession).save();
    await this.prisma.telegramSession.update({
      where: { id: 'default' },
      data: { sessionString, connected: true },
    });

    return { success: true };
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    await this.prisma.telegramSession.deleteMany();
    return { success: true };
  }

  async getClient(): Promise<TelegramClient> {
    // If client is null or disconnected, attempt to reconnect
    if (!this.client || !this.client.connected) {
      this.logger.warn('Telegram client not connected, attempting to reconnect...');
      this.client = null;
      const restored = await this.restoreSession();
      if (!restored || !this.client) {
        throw new Error('Telegram client not connected');
      }
    }
    return this.client;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  // Channel operations
  async createChannel(
    bucketName: string,
  ): Promise<{ channelId: bigint; accessHash: bigint }> {
    const client = await this.getClient();
    const result = await client.invoke(
      new Api.channels.CreateChannel({
        title: channelTitle(bucketName),
        about: `TGS3 Bucket: ${bucketName}`,
        broadcast: true,
        megagroup: false,
      }),
    );

    const channel = (result as any).chats[0];
    // Use .toString() to avoid precision loss when converting BigInteger → Number → BigInt
    return {
      channelId: BigInt(channel.id.toString()),
      accessHash: BigInt(channel.accessHash.toString()),
    };
  }

  async deleteChannel(channelId: bigint, accessHash: bigint): Promise<void> {
    const client = await this.getClient();
    await client.invoke(
      new Api.channels.DeleteChannel({
        channel: new Api.InputChannel({
          channelId: bigInt(channelId.toString()),
          accessHash: bigInt(accessHash.toString()),
        }),
      }),
    );
  }

  /**
   * Resolve a channel entity from stored channelId/accessHash.
   * After client reconnection, we must resolve the entity to ensure
   * GramJS has it in its internal cache.
   */
  private async resolveChannel(
    channelId: bigint,
    accessHash: bigint,
  ): Promise<Api.InputPeerChannel> {
    const client = await this.getClient();
    const chId = bigInt(channelId.toString());
    const accHash = bigInt(accessHash.toString());

    const inputChannel = new Api.InputChannel({
      channelId: chId,
      accessHash: accHash,
    });

    // Resolve the channel to ensure it's in the client's entity cache
    try {
      await client.invoke(
        new Api.channels.GetChannels({ id: [inputChannel] }),
      );
    } catch (error) {
      this.logger.warn(`Failed to pre-resolve channel ${channelId}: ${error}`);
    }

    return new Api.InputPeerChannel({
      channelId: chId,
      accessHash: accHash,
    });
  }

  // GramJS streams from file path for files > 20MB instead of buffering in memory.
  // We write to a temp file for large uploads so GramJS can stream it.
  private static readonly GRAMJS_BUFFER_THRESHOLD = 20 * 1024 * 1024;

  // File operations
  async uploadFile(
    channelId: bigint,
    accessHash: bigint,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    onProgress?: (percent: number) => void,
  ): Promise<{ messageId: number }> {
    const client = await this.getClient();
    const peer = await this.resolveChannel(channelId, accessHash);

    let tempFilePath: string | null = null;
    let file: CustomFile;

    if (buffer.length > TelegramService.GRAMJS_BUFFER_THRESHOLD) {
      // Write to temp file for large uploads
      tempFilePath = path.join(os.tmpdir(), `tgs3-${Date.now()}-${filename}`);
      fs.writeFileSync(tempFilePath, buffer);
      file = new CustomFile(filename, buffer.length, tempFilePath);
    } else {
      file = new CustomFile(filename, buffer.length, '', buffer);
    }

    try {
      const result = await client.sendFile(peer, {
        file,
        caption: '',
        workers: UPLOAD_WORKERS,
        attributes: [
          new Api.DocumentAttributeFilename({ fileName: filename }),
        ],
        forceDocument: true,
        progressCallback: onProgress
          ? (progress: number) => {
              onProgress(Math.round(progress * 100));
            }
          : undefined,
      });
      return { messageId: result.id };
    } finally {
      if (tempFilePath) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
    }
  }

  async downloadFile(
    channelId: bigint,
    accessHash: bigint,
    messageId: number,
  ): Promise<Buffer> {
    const client = await this.getClient();
    const peer = await this.resolveChannel(channelId, accessHash);

    const messages = await client.getMessages(peer, {
      ids: [messageId],
    });

    if (!messages[0] || !messages[0].media) {
      throw new Error('Message or media not found');
    }

    const buffer = await client.downloadMedia(messages[0].media, {});

    if (!buffer) {
      throw new Error('Failed to download file');
    }

    return buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  }

  async *streamDownloadFile(
    channelId: bigint,
    accessHash: bigint,
    messageId: number,
  ): AsyncGenerator<Buffer> {
    const client = await this.getClient();
    const peer = await this.resolveChannel(channelId, accessHash);

    const messages = await client.getMessages(peer, {
      ids: [messageId],
    });

    if (!messages[0] || !messages[0].media) {
      throw new Error('Message or media not found');
    }

    const iter = client.iterDownload({
      file: messages[0].media,
      requestSize: 512 * 1024,
    });

    for await (const chunk of iter) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any);
    }
  }

  async deleteMessages(
    channelId: bigint,
    accessHash: bigint,
    messageIds: number[],
  ): Promise<void> {
    const client = await this.getClient();
    const inputChannel = new Api.InputChannel({
      channelId: bigInt(channelId.toString()),
      accessHash: bigInt(accessHash.toString()),
    });

    await client.invoke(
      new Api.channels.DeleteMessages({
        channel: inputChannel,
        id: messageIds,
      }),
    );
  }
}
