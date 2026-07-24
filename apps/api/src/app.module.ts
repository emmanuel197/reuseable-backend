import { Module } from '@nestjs/common';
import { ObservabilityModule } from '@reuseablebackend/observability';
import { SecretsModule } from '@reuseablebackend/secrets';

@Module({
  imports: [
    // Observability is registered first so its global tracer/meter providers are
    // live before other modules initialise. `console` exporter is the Wave-1 dev
    // default; swap to `otlp` (with an endpoint) for Grafana LGTM / Datadog.
    ObservabilityModule.forRoot({
      serviceName: 'api',
      exporter: 'console',
    }),
    // The env provider is the Wave-1 default; requiredKeys are validated at boot.
    SecretsModule.forRootAsync({
      useFactory: () => ({
        requiredKeys: [],
      }),
    }),
  ],
})
export class AppModule {}
