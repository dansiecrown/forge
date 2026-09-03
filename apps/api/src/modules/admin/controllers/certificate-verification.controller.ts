import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../../decorators/public.decorator';
import { AppException } from '../../../shared/errors/app.exception';
import { CertificatesService } from '../services/certificates.service';

/** Public, unauthenticated certificate verification — the one route in
 * `AdminModule` that bypasses `JwtAuthGuard` entirely via `@Public()`. */
@Controller('public/certificates')
export class CertificateVerificationController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('verify/:code')
  @Public()
  async verify(@Param('code') code: string) {
    const result = await this.certificatesService.getPublicVerification(code);
    if (!result) {
      throw AppException.notFound('No issued certificate matches this verification code.');
    }
    return result;
  }
}
