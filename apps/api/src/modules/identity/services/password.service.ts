import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppConfigService } from '../../../config/app-config.service';

@Injectable()
export class PasswordService {
  constructor(private readonly config: AppConfigService) {}

  async hash(plainPassword: string): Promise<string> {
    const { memoryCost, timeCost, parallelism } = this.config.auth.argon2;
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost,
      timeCost,
      parallelism,
    });
  }

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      return false;
    }
  }
}
