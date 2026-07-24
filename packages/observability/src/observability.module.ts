import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { Resource } from '@opentelemetry/resources';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { z } from 'zod';
import { OBS_OPTIONS } from './constants';
import { type ExporterConfig, type ExporterKind, buildSpanProcessors } from './exporter-provider';
import { ObsLogger } from './logger.service';
import { Tracing } from './tracing.service';

export interface ObservabilityModuleOptions {
  /** Logical service name attached to all telemetry (OTel `service.name`). */
  serviceName: string;
  /** Which backend to export to. */
  exporter: ExporterKind;
  /** OTLP endpoint — required when `exporter` is `otlp`. */
  otlpEndpoint?: string;
  /** Advanced/test hook: override span processors directly (e.g. an in-memory exporter). */
  spanProcessors?: SpanProcessor[];
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
    // The otlpEndpoint requirement is waived when the caller supplies their own
    // span processors (the exporter selection is then bypassed entirely).
    hasSpanProcessors: z.boolean(),
  })
  .refine((o) => o.exporter !== 'otlp' || o.hasSpanProcessors || Boolean(o.otlpEndpoint), {
    message: 'otlpEndpoint is required when exporter is "otlp"',
    path: ['otlpEndpoint'],
  });

function validate(options: ObservabilityModuleOptions): ObservabilityModuleOptions {
  optionsSchema.parse({
    serviceName: options.serviceName,
    exporter: options.exporter,
    otlpEndpoint: options.otlpEndpoint,
    hasSpanProcessors: Boolean(options.spanProcessors),
  });
  return options;
}

/** Map user-facing options to the internal exporter config (validated upstream). */
function toExporterConfig(options: ObservabilityModuleOptions): ExporterConfig {
  return options.exporter === 'otlp'
    ? { kind: 'otlp', otlpEndpoint: options.otlpEndpoint as string }
    : { kind: options.exporter };
}

function startProvider(options: ObservabilityModuleOptions): NodeTracerProvider {
  const spanProcessors = options.spanProcessors ?? buildSpanProcessors(toExporterConfig(options));
  const provider = new NodeTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: options.serviceName }),
    spanProcessors,
  });
  provider.register(); // sets the global tracer provider + async context manager
  return provider;
}

/** Assemble the ObservabilityModule DynamicModule around the given providers. */
function assembleModule(
  providers: Provider[],
  imports: DynamicModule['imports'] = [],
): DynamicModule {
  return {
    module: ObservabilityModule,
    imports,
    providers: [...providers, ObsLogger, Tracing],
    exports: [ObsLogger, Tracing],
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
  constructor(@Inject(OBS_PROVIDER) private readonly provider: NodeTracerProvider) {}

  static forRoot(options: ObservabilityModuleOptions): DynamicModule {
    // Validate at call time (not inside the factory) so a misconfiguration throws
    // here with a clear stack, not deep in Nest's DI bootstrap.
    const validated = validate(options);
    const optionsProvider: Provider = { provide: OBS_OPTIONS, useValue: validated };
    const providerFactory: Provider = {
      provide: OBS_PROVIDER,
      inject: [OBS_OPTIONS],
      useFactory: (o: ObservabilityModuleOptions) => startProvider(o),
    };
    return assembleModule([optionsProvider, providerFactory]);
  }

  static forRootAsync(options: ObservabilityModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: OBS_OPTIONS,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => validate(await options.useFactory(...args)),
    };
    const providerFactory: Provider = {
      provide: OBS_PROVIDER,
      inject: [OBS_OPTIONS],
      useFactory: (o: ObservabilityModuleOptions) => startProvider(o),
    };
    return assembleModule([optionsProvider, providerFactory], options.imports ?? []);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}
