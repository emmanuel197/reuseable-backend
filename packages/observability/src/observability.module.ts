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
import { type ExporterKind, buildSpanProcessors } from './exporter-provider';
import { ObsLogger } from './logger.service';

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
  })
  .refine((o) => o.exporter !== 'otlp' || Boolean(o.otlpEndpoint), {
    message: 'otlpEndpoint is required when exporter is "otlp"',
    path: ['otlpEndpoint'],
  });

function validate(options: ObservabilityModuleOptions): ObservabilityModuleOptions {
  optionsSchema.parse({
    serviceName: options.serviceName,
    exporter: options.exporter,
    otlpEndpoint: options.otlpEndpoint,
  });
  return options;
}

function startProvider(options: ObservabilityModuleOptions): NodeTracerProvider {
  const spanProcessors =
    options.spanProcessors ??
    buildSpanProcessors({ kind: options.exporter, otlpEndpoint: options.otlpEndpoint });
  const provider = new NodeTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: options.serviceName }),
    spanProcessors,
  });
  provider.register(); // sets the global tracer provider + async context manager
  return provider;
}

/** Assemble the ObservabilityModule DynamicModule around a bound provider factory. */
function assembleModule(
  providerFactory: Provider,
  imports: DynamicModule['imports'] = [],
): DynamicModule {
  return {
    module: ObservabilityModule,
    imports,
    providers: [providerFactory, ObsLogger],
    exports: [ObsLogger],
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
    const providerFactory: Provider = {
      provide: OBS_PROVIDER,
      useFactory: () => startProvider(validate(options)),
    };
    return assembleModule(providerFactory);
  }

  static forRootAsync(options: ObservabilityModuleAsyncOptions): DynamicModule {
    const providerFactory: Provider = {
      provide: OBS_PROVIDER,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) =>
        startProvider(validate(await options.useFactory(...args))),
    };
    return assembleModule(providerFactory, options.imports ?? []);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}
