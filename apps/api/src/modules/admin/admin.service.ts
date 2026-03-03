import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const adminUsername = this.configService.get<string>(
      'ADMIN_USERNAME',
      'admin',
    );
    const adminPassword = this.configService.get<string>(
      'ADMIN_PASSWORD',
      'changeme',
    );

    if (username !== adminUsername || password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.jwtService.signAsync({
      sub: 'admin',
      username: adminUsername,
    });

    return { token };
  }
}
