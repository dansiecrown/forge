import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { Public } from '../../../decorators/public.decorator';
import { hashOpaqueToken } from '../../../shared/crypto/opaque-token';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from '../../../shared/http/refresh-cookie';
import { AuditLogService } from '../../platform/audit-log.service';
import { AuthSessionsRepository } from '../repositories/auth-sessions.repository';
import { AccessTokenService } from '../services/access-token.service';
import { AuthService } from '../services/auth.service';
import { MfaService } from '../services/mfa.service';
import { UsersService } from '../services/users.service';
import {
  ChangePasswordDto,
  ConfirmMfaEnrollmentDto,
  DisableMfaDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  MfaEnrollDto,
  MfaVerifyDto,
  ResendVerificationEmailDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../dtos/auth.dto';

function deviceContext(req: AuthenticatedRequest) {
  return {
    deviceLabel: req.header('User-Agent')?.slice(0, 200),
    ipHash: req.ip ? hashOpaqueToken(req.ip) : undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
    private readonly accessTokenService: AccessTokenService,
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto.email,
      dto.password,
      deviceContext(req),
      req.requestId,
    );

    if (result.mfaRequired) {
      return { mfaRequired: true, mfaChallengeToken: result.mfaChallengeToken };
    }

    setRefreshCookie(res, result.refreshToken!, result.refreshTokenExpiresAt!);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
      mfaRequired: false,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const presented = req.signedCookies?.[REFRESH_COOKIE_NAME];
    if (!presented) {
      throw AppException.unauthenticated('No active session.', 'SESSION_REVOKED');
    }

    const rotated = await this.authService.refresh(presented, deviceContext(req));
    setRefreshCookie(res, rotated.refreshToken, rotated.refreshTokenExpiresAt);
    return { accessToken: rotated.token, expiresIn: rotated.expiresIn };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented: string | undefined = req.signedCookies?.[REFRESH_COOKIE_NAME];
    const bearer = req.header('Authorization');
    let userId: string | undefined;
    if (bearer?.startsWith('Bearer ')) {
      try {
        userId = this.accessTokenService.verify(bearer.slice('Bearer '.length)).sub;
      } catch {
        userId = undefined;
      }
    }

    await this.authService.logout(presented, userId, Boolean(dto.allSessions));
    clearRefreshCookie(res);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If an account exists for this email, a reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('verification-email')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerificationEmail(@Body() dto: ResendVerificationEmailDto) {
    await this.authService.sendVerificationEmail(dto.email);
    return { message: 'If an account exists for this email, a verification link has been sent.' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: { id: string }, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get('sessions')
  async listSessions(
    @CurrentUser() user: { id: string },
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const sessions = await this.authSessionsRepository.listActiveForUser(user.id, {
      cursor,
      limit: parseLimit(limit),
    });
    const presented: string | undefined = req.signedCookies?.[REFRESH_COOKIE_NAME];
    const presentedHash = presented ? hashOpaqueToken(presented) : undefined;
    return new CollectionResult(
      sessions.items.map((session) => ({
        id: session.id,
        device: session.deviceLabel ?? 'Unknown device',
        current: session.refreshTokenHash === presentedHash,
        lastUsedAt: session.issuedAt,
      })),
      sessions.page,
    );
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@CurrentUser() user: { id: string }, @Param('sessionId') sessionId: string) {
    const session = await this.authSessionsRepository.findById(sessionId);
    if (!session || session.userId !== user.id) {
      throw AppException.notFound('Session not found.');
    }
    await this.authSessionsRepository.revoke(sessionId);
  }

  @Post('mfa/enroll')
  async enrollMfa(@CurrentUser() user: { id: string }, @Body() _dto: MfaEnrollDto) {
    const currentUser = await this.usersService.getById(user.id);
    const enrollment = await this.mfaService.enroll(user.id, currentUser.emailCanonical);
    return enrollment;
  }

  @Post('mfa/confirm-enrollment')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmMfaEnrollment(
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmMfaEnrollmentDto,
  ) {
    await this.mfaService.verifyEnrollment(user.id, dto.factorId, dto.code);
    await this.auditLog.record({
      action: 'mfa.enrollment_confirmed',
      entityType: 'mfa_factor',
      entityId: dto.factorId,
      outcome: 'success',
      actorUserId: user.id,
    });
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableMfa(@CurrentUser() user: { id: string }, @Body() dto: DisableMfaDto) {
    await this.mfaService.disable(user.id, dto.code);
    await this.auditLog.record({
      action: 'mfa.disabled',
      entityType: 'user',
      entityId: user.id,
      outcome: 'success',
      actorUserId: user.id,
    });
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bearer = req.header('Authorization');
    const token = bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : undefined;
    if (!token) {
      throw AppException.unauthenticated();
    }

    const result = await this.authService.verifyMfaEndpoint(
      token,
      dto.code,
      dto.factorId,
      deviceContext(req),
    );

    if ('refreshToken' in result && result.refreshToken && result.refreshTokenExpiresAt) {
      setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
        mfaRequired: false,
      };
    }

    return result;
  }
}
