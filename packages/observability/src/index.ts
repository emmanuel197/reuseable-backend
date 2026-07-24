/**
 * BARREL — the only public surface of @reuseablebackend/observability.
 * Exporter adapters stay internal; consumers pick a backend via module options.
 */
export {
  ObservabilityModule,
  type ObservabilityModuleOptions,
  type ObservabilityModuleAsyncOptions,
} from './observability.module';
export { ObsLogger, type LogLevel } from './logger.service';
export { Tracing } from './tracing.service';
export { type ExporterKind, type ExporterConfig } from './exporter-provider';
