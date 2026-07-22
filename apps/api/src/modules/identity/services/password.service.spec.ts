import { AppConfigService } from '../../../config/app-config.service';
import { PasswordService } from './password.service';

function fakeConfig(): AppConfigService {
  return {
    auth: { argon2: { memoryCost: 1024, timeCost: 2, parallelism: 1 } },
  } as unknown as AppConfigService;
}

describe('PasswordService', () => {
  const service = new PasswordService(fakeConfig());

  it('hashes and verifies a matching password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('never stores the plaintext password in the hash', async () => {
    const plain = 'super-secret-password';
    const hash = await service.hash(plain);
    expect(hash).not.toContain(plain);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('returns false instead of throwing for a malformed stored hash', async () => {
    await expect(service.verify('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});
