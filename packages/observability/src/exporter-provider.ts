import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

/**
 * The exporter backend — the ONE variation point. `console` prints spans (dev);
 * `otlp` ships them to an OTLP endpoint (Grafana LGTM / Datadog); `none` disables
 * export (spans still created, useful in tests/CI). Swapping backends is a config
 * change, not a code change to the module or its consumers.
 */
export type ExporterKind = 'console' | 'otlp' | 'none';

export interface ExporterConfig {
  kind: ExporterKind;
  /** OTLP HTTP endpoint — required when `kind` is `otlp`. */
  otlpEndpoint?: string;
}

/** Build the span processors for the chosen backend. */
export function buildSpanProcessors(config: ExporterConfig): SpanProcessor[] {
  switch (config.kind) {
    case 'console':
      return [new SimpleSpanProcessor(new ConsoleSpanExporter())];
    case 'otlp':
      return [new BatchSpanProcessor(new OTLPTraceExporter({ url: config.otlpEndpoint }))];
    case 'none':
      return [];
  }
}

/** Wrap any exporter as a simple (synchronous) processor — e.g. an in-memory one in tests. */
export function spanProcessorForExporter(exporter: SpanExporter): SpanProcessor {
  return new SimpleSpanProcessor(exporter);
}
