import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ObsLogger, Tracing } from '@reuseablebackend/observability';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Let Nest fire onApplicationShutdown so the observability providers flush and
  // shut down (final span/metric export) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const tracing = app.get(Tracing);
  const logger = app.get(ObsLogger);

  const port = process.env.PORT ?? 3000;
  // Record startup inside a span — the log line carries its trace_id, a smoke check
  // that tracing, logging, and trace-correlation are wired end to end. The span ends
  // BEFORE listen() binds the socket, so an early request can't be parented to it.
  await tracing.withSpan('api.startup', () => {
    logger.info('api starting', { port: Number(port) });
  });
  await app.listen(port);
  logger.info('api listening', { port: Number(port) });
}

void bootstrap();
