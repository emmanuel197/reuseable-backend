import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { MeterProvider, type MetricReader } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { z } from 'zod';
import { OBS_OPTIONS } from './constants';
import {
  type ExporterConfig,
  type ExporterKind,
  buildMetricReaders,
  buildSpanProcessors,
} from './exporter-provider';
import { ObsLogger } from './logger.service';
import { Metrics } from './metrics.service';
import { Tracing } from './tracing.service';

export interface ObservabilityModuleOptions {
  /** Logical service name attached to all telemetry (OTel `service.name`). */
  serviceName: string;
  /** Which backend to export to. */
  exporter: ExporterKind;
  /**
   * Base OTLP/HTTP endpoint (e.g. `http://localhost:4318`) — required when `exporter`
   * is `otlp`. The per-signal path (`/v1/traces`, `/v1/metrics`) is appended per exporter;
   * do NOT include a signal path.
   */
  otlpEndpoint?: string;
  /** Advanced/test hook: override span processors directly (e.g. an in-memory exporter). */
  spanProcessors?: SpanProcessor[];
  /** Advanced/test hook: override metric readers directly (e.g. an in-memory reader). */
  metricReaders?: MetricReader[];
}

export interface ObservabilityModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<ObservabilityModuleOptions> | ObservabilityModuleOptions;
}

const OBS_PROVIDER = Symbol('OBS_PROVIDER');

const optionsSchema = z
  .object({
    serviceName: z.string().min(1, 'serviceName is required'),
    exporter: z.enum(['console', 'otlp', 'none']),
    otlpEndpoint: z.string().url().optional(),
    // The otlpEndpoint requirement is waived only when the caller overrides BOTH the
    // span processors and the metric readers — otherwise the un-overridden signal is
    // built from the exporter config and would reach the SDK's silent localhost fallback.
    hasSpanProcessors: z.boolean(),
    hasMetricReaders: z.boolean(),
  })
  .refine(
    (o) =>
      o.exporter !== 'otlp' ||
      (o.hasSpanProcessors && o.hasMetricReaders) ||
      Boolean(o.otlpEndpoint),
    {
      message: 'otlpEndpoint is required when exporter is "otlp"',
      path: ['otlpEndpoint'],
    },
  );

function validate(options: ObservabilityModuleOptions): ObservabilityModuleOptions {
  optionsSchema.parse({
    serviceName: options.serviceName,
    exporter: options.exporter,
    otlpEndpoint: options.otlpEndpoint,
    hasSpanProcessors: Boolean(options.spanProcessors),
    hasMetricReaders: Boolean(options.metricReaders),
  });
  return options;
}

/** Map user-facing options to the internal exporter config (validated upstream). */
function toExporterConfig(options: ObservabilityModuleOptions): ExporterConfig {
  return options.exporter === 'otlp'
    ? { kind: 'otlp', otlpEndpoint: options.otlpEndpoint as string }
    : { kind: options.exporter };
}

/** The started OTel providers, held so the module can flush/shutdown both on exit. */
interface ObsProviders {
  tracerProvider: NodeTracerProvider;
  meterProvider: MeterProvider;
}

function startProvider(options: ObservabilityModuleOptions): ObsProviders {
  const resource = new Resource({ [ATTR_SERVICE_NAME]: options.serviceName });
  const exporterConfig = toExporterConfig(options);

  const spanProcessors = options.spanProcessors ?? buildSpanProcessors(exporterConfig);
  const tracerProvider = new NodeTracerProvider({ resource, spanProcessors });
  tracerProvider.register(); // sets the global tracer provider + async context manager

  const readers = options.metricReaders ?? buildMetricReaders(exporterConfig);
  const meterProvider = new MeterProvider({ resource, readers });
  metrics.setGlobalMeterProvider(meterProvider); // sets the global meter provider

  return { tracerProvider, meterProvider };
}

/** Assemble the ObservabilityModule DynamicModule around the given providers. */
function assembleModule(
  providers: Provider[],
  imports: DynamicModule['imports'] = [],
): DynamicModule {
  return {
    module: ObservabilityModule,
    imports,
    providers: [...providers, ObsLogger, Tracing, Metrics],
    exports: [ObsLogger, Tracing, Metrics],
  };
}

/**
 * The OBS_PROVIDER factory — starts the OTel providers from the resolved OBS_OPTIONS.
 * Identical for `forRoot`/`forRootAsync`; only how OBS_OPTIONS is produced differs.
 */
function obsProviderFactory(): Provider {
  return {
    provide: OBS_PROVIDER,
    inject: [OBS_OPTIONS],
    useFactory: (o: ObservabilityModuleOptions) => startProvider(o),
  };
}

/**
 * Wraps the OpenTelemetry tracer provider as a NestJS module: `forRoot`/`forRootAsync`
 * validate config (zod), register the provider with the chosen exporter, expose
 * `ObsLogger`, and flush/shutdown the provider on application shutdown.
 */
@Global()
@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  constructor(@Inject(OBS_PROVIDER) private readonly providers: ObsProviders) {}

  static forRoot(options: ObservabilityModuleOptions): DynamicModule {
    // Validate at call time (not inside the factory) so a misconfiguration throws
    // here with a clear stack, not deep in Nest's DI bootstrap.
    const validated = validate(options);
    const optionsProvider: Provider = { provide: OBS_OPTIONS, useValue: validated };
    return assembleModule([optionsProvider, obsProviderFactory()]);
  }

  static forRootAsync(options: ObservabilityModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: OBS_OPTIONS,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => validate(await options.useFactory(...args)),
    };
    return assembleModule([optionsProvider, obsProviderFactory()], options.imports ?? []);
  }

  async onApplicationShutdown(): Promise<void> {
    // Flush/shutdown both signal providers; the meter reader is periodic, so this
    // forces a final export instead of dropping the last interval's metrics.
    await Promise.all([
      this.providers.tracerProvider.shutdown(),
      this.providers.meterProvider.shutdown(),
    ]);
  }
}
