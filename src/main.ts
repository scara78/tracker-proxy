import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const origins = configService.get<string>('ALLOWED_ORIGINS');
  const origin = origins.split(',');

  app.enableCors({ origin });

  await app.listen(3001);
}
bootstrap();
