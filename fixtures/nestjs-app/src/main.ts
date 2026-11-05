import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  // In-memory MongoDB so the fixture starts with one command and no install.
  const mongo = await MongoMemoryServer.create();
  const app = await NestFactory.create(AppModule.forRoot(mongo.getUri()));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const stop = async (): Promise<void> => {
    await app.close();
    await mongo.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port, '127.0.0.1');
  Logger.log(`nestjs-app listening on ${await app.getUrl()}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error('nestjs-app failed to start', error instanceof Error ? error.stack : error);
  process.exit(1);
});
