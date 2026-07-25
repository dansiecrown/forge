import { join } from 'node:path';
import { config } from 'dotenv';

// Integration specs (*.integration.spec.ts) connect PrismaService to the
// real dev Postgres (docker-compose.dev.yml) — DATABASE_URL isn't otherwise
// loaded when jest runs standalone (unlike the npm scripts, which wrap
// commands in `dotenv -e ../../.env --`).
config({ path: join(__dirname, '../../../.env') });
