import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { EMAIL_ADAPTER } from '../../shared/email/email-adapter';
import { ConsoleEmailAdapter } from '../../shared/email/console-email.adapter';
import { IdempotencyService } from '../../shared/idempotency/idempotency.service';
import { AuthController } from './controllers/auth.controller';
import { MeController } from './controllers/me.controller';
import { UsersController } from './controllers/users.controller';
import { AuthSessionsRepository } from './repositories/auth-sessions.repository';
import { ExternalIdentitiesRepository } from './repositories/external-identities.repository';
import { MfaFactorsRepository, RecoveryCodesRepository } from './repositories/mfa.repository';
import { PasswordCredentialsRepository } from './repositories/password-credentials.repository';
import { UsersRepository } from './repositories/users.repository';
import {
  EmailVerificationTokensRepository,
  PasswordResetTokensRepository,
} from './repositories/verification-tokens.repository';
import { AccessTokenService } from './services/access-token.service';
import { AuthService } from './services/auth.service';
import { MfaService } from './services/mfa.service';
import { PasswordService } from './services/password.service';
import { RefreshSessionService } from './services/refresh-session.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [JwtModule.register({}), OrganizationsModule, PlatformModule],
  controllers: [AuthController, MeController, UsersController],
  providers: [
    UsersRepository,
    ExternalIdentitiesRepository,
    PasswordCredentialsRepository,
    AuthSessionsRepository,
    MfaFactorsRepository,
    RecoveryCodesRepository,
    PasswordResetTokensRepository,
    EmailVerificationTokensRepository,
    PasswordService,
    AccessTokenService,
    RefreshSessionService,
    MfaService,
    AuthService,
    UsersService,
    IdempotencyService,
    { provide: EMAIL_ADAPTER, useClass: ConsoleEmailAdapter },
  ],
  exports: [AccessTokenService, UsersRepository, UsersService],
})
export class IdentityModule {}
