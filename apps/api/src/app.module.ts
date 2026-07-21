import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../../.env'),
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        API_PORT: Joi.number().port().default(3000),
        WEB_ORIGIN: Joi.string().uri().required(),
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
