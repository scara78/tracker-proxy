import { NestFactory } from '@nestjs/core';

import { readFileSync } from 'fs';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions: process.env.SSL_KEY_PATH
      ? {
          key: readFileSync(process.env.SSL_KEY_PATH),
          cert: readFileSync(process.env.SSL_CERT_PATH),
        }
      : undefined,
  });

  const origins = process.env.ALLOWED_ORIGINS;
  const origin = origins?.split(',');

  app.enableCors({ origin });

  await app.listen(8000);
}
bootstrap();
