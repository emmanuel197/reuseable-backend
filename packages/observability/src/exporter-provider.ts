import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  ConsoleMetricExporter,
  type MetricReader,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

/**
 * The exporter backend — the ONE variation point. `console` prints spans (dev);
 * `otlp` ships them to an OTLP endpoint (Grafana LGTM / Datadog); `none` disables
 * export (spans still created, useful in tests/CI). Swapping backends is a config
 * change, not a code change to the module or its consumers.
 */
export type ExporterKind = 'console' | 'otlp' | 'none';

/**
 * Discriminated union so the `otlp` backend requires an endpoint at the type
 * level — a direct caller can't reach the SDK's silent `localhost:4318` fallback.
 */
export type ExporterConfig =
  | { kind: 'console' }
  | { kind: 'none' }
  | { kind: 'otlp'; otlpEndpoint: string };

/** Build the span processors for the chosen backend. */
export function buildSpanProcessors(config: ExporterConfig): SpanProcessor[] {
  switch (config.kind) {
    case 'console':
      return [new SimpleSpanProcessor(new ConsoleSpanExporter())];
    case 'none':
      return [];
    case 'otlp':
      return [new BatchSpanProcessor(new OTLPTraceExporter({ url: config.otlpEndpoint }))];
  }
}

/**
 * Build the metric readers for the chosen backend, mirroring {@link buildSpanProcessors}.
 * A `PeriodicExportingMetricReader` pulls aggregated metrics on an interval and pushes
 * them to the exporter; `none` yields no readers (instruments still record, nothing exports).
 */
export function buildMetricReaders(config: ExporterConfig): MetricReader[] {
  switch (config.kind) {
    case 'console':
      return [new PeriodicExportingMetricReader({ exporter: new ConsoleMetricExporter() })];
    case 'none':
      return [];
    case 'otlp':
      return [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: config.otlpEndpoint }),
        }),
      ];
  }
}
