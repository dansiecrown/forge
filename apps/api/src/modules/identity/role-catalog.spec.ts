import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Regression guard for docs/adr/0012-hierarchy-provisioning.md Decision 1 —
 * there is intentionally no Fellowship Admin role, and none should ever be
 * added. Reads the seed file's source text rather than importing the module
 * (which runs a real, unconditional `main()` against the database on import
 * — not something a unit test should trigger) since `identity.seed.ts` is
 * the single source of truth for every role this platform defines. */
describe('identity.seed role catalog', () => {
  const source = readFileSync(join(__dirname, '../../../prisma/seeds/identity.seed.ts'), 'utf-8');

  it('never defines a Fellowship Admin role', () => {
    expect(source).not.toMatch(/FELLOWSHIP_ADMIN/i);
  });

  it('defines exactly the five intended roles', () => {
    const keys = [...source.matchAll(/key:\s*'([A-Z_]+)',\n\s*name:/g)].map((match) => match[1]);
    expect(keys).toEqual(['SUPER_ADMIN', 'ORG_ADMIN', 'ACADEMY_ADMIN', 'MENTOR', 'STUDENT']);
  });
});
