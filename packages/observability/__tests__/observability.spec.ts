import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { InMemoryMetricExporter, AggregationTemporality, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { buildMetricReaders, buildSpanProcessors, otlpSignalUrl } from '../src/exporter-provider';
import { ObsLogger } from '../src/logger.service';
import { ObservabilityModule } from '../src/observability.module';

describe('exporter port', () => {
  it('console builds one processor, none builds zero', () => {
    expect(buildSpanProcessors({ kind: 'console' })).toHaveLength(1);
    expect(buildSpanProcessors({ kind: 'none' })).toHaveLength(0);
  });

  it('otlp builds one processor', () => {
    expect(buildSpanProcessors({ kind: 'otlp', otlpEndpoint: 'http://localhost:4318' })).toHaveLength(1);
  });

  it('otlpSignalUrl derives per-signal paths from a base endpoint (and trims trailing slashes)', () => {
    expect(otlpSignalUrl('http://localhost:4318', 'traces')).toBe('http://localhost:4318/v1/traces');
    expect(otlpSignalUrl('http://localhost:4318', 'metrics')).toBe('http://localhost:4318/v1/metrics');
    expect(otlpSignalUrl('http://collector:4318/', 'traces')).toBe('http://collector:4318/v1/traces');
    expect(otlpSignalUrl('https://otlp.example.com/base//', 'metrics')).toBe('https://otlp.example.com/base/v1/metrics');
  });

  it('metric readers mirror the span port: console/otlp build one, none builds zero', async () => {
    const console = buildMetricReaders({ kind: 'console' });
    const none = buildMetricReaders({ kind: 'none' });
    const otlp = buildMetricReaders({ kind: 'otlp', otlpEndpoint: 'http://localhost:4318' });
    expect(console).toHaveLength(1);
    expect(none).toHaveLength(0);
    expect(otlp).toHaveLength(1);
    // Each PeriodicExportingMetricReader starts a setInterval; shut them down so the
    // timers don't leak (open handles) or POST to localhost:4318 during the test run.
    await Promise.all([...console, ...otlp].map((r) => r.shutdown()));
  });
});

describe('ObservabilityModule.forRoot validation', () => {
  it('throws at call time when exporter is otlp without an endpoint', () => {
    expect(() => ObservabilityModule.forRoot({ serviceName: 's', exporter: 'otlp' })).toThrow();
  });

  it('still requires an endpoint when only span processors are overridden (metrics would fall back)', () => {
    expect(() =>
      ObservabilityModule.forRoot({
        serviceName: 's',
        exporter: 'otlp',
        spanProcessors: [new SimpleSpanProcessor(new InMemorySpanExporter())],
      }),
    ).toThrow();
  });

  it('waives the endpoint requirement when BOTH span processors and metric readers override the exporter', () => {
    expect(() =>
      ObservabilityModule.forRoot({
        serviceName: 's',
        exporter: 'otlp',
        spanProcessors: [new SimpleSpanProcessor(new InMemorySpanExporter())],
        metricReaders: [
          new PeriodicExportingMetricReader({
            exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
          }),
        ],
      }),
    ).not.toThrow();
  });

  it('throws on an empty serviceName', () => {
    expect(() => ObservabilityModule.forRoot({ serviceName: '', exporter: 'none' })).toThrow();
  });
});

describe('ObsLogger structured records', () => {
  const logger = new ObsLogger({ serviceName: 'obs-test' });

  it('emits level, service, message, and fields with no trace when no span is active', () => {
    const rec = logger.record('info', 'hello', { userId: 7 });
    expect(rec.level).toBe('info');
    expect(rec.service).toBe('obs-test');
    expect(rec.message).toBe('hello');
    expect(rec.userId).toBe(7);
    expect(typeof rec.time).toBe('string');
    expect(rec.trace_id).toBeUndefined();
  });

  it('reserved structured fields win over colliding caller fields (incl. trace_id with no span)', () => {
    const rec = logger.record('warn', 'real message', {
      level: 'debug',
      message: 'spoofed',
      service: 'x',
      trace_id: 'fake',
      span_id: 'fake',
    });
    expect(rec.level).toBe('warn');
    expect(rec.message).toBe('real message');
    expect(rec.service).toBe('obs-test');
    expect(rec.trace_id).toBeUndefined();
    expect(rec.span_id).toBeUndefined();
  });
});

describe('ObsLogger trace correlation (real provider + in-memory exporter)', () => {
  const memory = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(memory)],
  });
  const logger = new ObsLogger({ serviceName: 'obs-test' });

  beforeAll(() => {
    trace.disable(); // clear any global provider leaked from another test file
    provider.register();
  });
  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
  });

  it('injects the active trace_id/span_id and exports the span', () => {
    const tracer = trace.getTracer('test');
    tracer.startActiveSpan('unit-op', (span) => {
      const rec = logger.record('info', 'inside span');
      expect(rec.trace_id).toBe(span.spanContext().traceId);
      expect(rec.span_id).toBe(span.spanContext().spanId);
      span.end();
    });

    const finished = memory.getFinishedSpans();
    expect(finished.some((s) => s.name === 'unit-op')).toBe(true);
  });
});
