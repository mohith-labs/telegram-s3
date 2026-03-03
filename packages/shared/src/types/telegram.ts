export interface TelegramStatus {
  connected: boolean;
  phoneNumber?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface SendCodeDto {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
}

export interface VerifyCodeDto {
  phoneNumber: string;
  code: string;
  phoneCodeHash: string;
}

export interface Verify2FADto {
  password: string;
}

export interface SendCodeResponse {
  phoneCodeHash: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  need2FA?: boolean;
}
