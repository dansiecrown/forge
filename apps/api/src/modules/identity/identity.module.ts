import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { AppConfigService } from '../../config/app-config.service';
import { EMAIL_ADAPTER } from '../../shared/email/email-adapter';
import { ConsoleEmailAdapter } from '../../shared/email/console-email.adapter';
import { SmtpEmailAdapter } from '../../shared/email/smtp-email.adapter';
import { IdempotencyService } from '../../shared/idempotency/idempotency.service';
import { AuthController } from './controllers/auth.controller';
import { MeController } from './controllers/me.controller';
import { ProfileController } from './controllers/profile.controller';
import { UsersController } from './controllers/users.controller';
import { AuthSessionsRepository } from './repositories/auth-sessions.repository';
import { ExternalIdentitiesRepository } from './repositories/external-identities.repository';
import { MfaFactorsRepository, RecoveryCodesRepository } from './repositories/mfa.repository';
import { PasswordCredentialsRepository } from './repositories/password-credentials.repository';
import { UserProfilesRepository } from './repositories/user-profiles.repository';
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
import { UserProfilesService } from './services/user-profiles.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [JwtModule.register({}), OrganizationsModule, PlatformModule],
  controllers: [AuthController, MeController, ProfileController, UsersController],
  providers: [
    UsersRepository,
    ExternalIdentitiesRepository,
    PasswordCredentialsRepository,
    AuthSessionsRepository,
    MfaFactorsRepository,
    RecoveryCodesRepository,
    PasswordResetTokensRepository,
    EmailVerificationTokensRepository,
    UserProfilesRepository,
    PasswordService,
    AccessTokenService,
    RefreshSessionService,
    MfaService,
    AuthService,
    UsersService,
    UserProfilesService,
    IdempotencyService,
    SmtpEmailAdapter,
    ConsoleEmailAdapter,
    // Real delivery only when SMTP is actually configured — see
    // docs/adr/0009-administration-platform.md's 2026-09-06 email addendum.
    // An environment with no SMTP_* set keeps the pre-existing console-log
    // behavior unchanged.
    {
      provide: EMAIL_ADAPTER,
      useFactory: (
        config: AppConfigService,
        smtp: SmtpEmailAdapter,
        console: ConsoleEmailAdapter,
      ) => (config.email.host ? smtp : console),
      inject: [AppConfigService, SmtpEmailAdapter, ConsoleEmailAdapter],
    },
  ],
  exports: [
    AccessTokenService,
    UsersService,
    MfaService,
    RefreshSessionService,
    UserProfilesService,
  ],
})
export class IdentityModule {}
