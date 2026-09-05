import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, AuthConfig, RedisConfig } from './configuration';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get app(): AppConfig {
    return this.configService.getOrThrow<AppConfig>('app');
  }

  get auth(): AuthConfig {
    return this.configService.getOrThrow<AuthConfig>('auth');
  }

  get redis(): RedisConfig {
    return this.configService.getOrThrow<RedisConfig>('redis');
  }
}
