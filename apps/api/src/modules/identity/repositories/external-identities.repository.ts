import { Injectable } from '@nestjs/common';
import { ExternalIdentityProvider, type ExternalIdentity } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ExternalIdentitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProviderSubject(
    provider: ExternalIdentityProvider,
    providerSubject: string,
  ): Promise<ExternalIdentity | null> {
    return this.prisma.externalIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject } },
    });
  }

  create(
    userId: string,
    provider: ExternalIdentityProvider,
    providerSubject: string,
    verifiedAt?: Date,
  ): Promise<ExternalIdentity> {
    return this.prisma.externalIdentity.create({
      data: { userId, provider, providerSubject, verifiedAt },
    });
  }
}
