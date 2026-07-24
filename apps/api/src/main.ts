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
  // Wrap startup in a span so the first log line carries a trace_id — a smoke
  // check that tracing, logging, and trace-correlation are all wired end to end.
  await tracing.withSpan('api.startup', async () => {
    await app.listen(port);
    logger.info('api listening', { port: Number(port) });
  });
}

void bootstrap();
