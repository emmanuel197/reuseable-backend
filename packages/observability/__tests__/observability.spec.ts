import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { buildSpanProcessors } from '../src/exporter-provider';
import { ObsLogger } from '../src/logger.service';

describe('exporter port', () => {
  it('console builds one processor, none builds zero', () => {
    expect(buildSpanProcessors({ kind: 'console' })).toHaveLength(1);
    expect(buildSpanProcessors({ kind: 'none' })).toHaveLength(0);
  });

  it('otlp builds one processor', () => {
    expect(buildSpanProcessors({ kind: 'otlp', otlpEndpoint: 'http://localhost:4318/v1/traces' })).toHaveLength(1);
  });
});

describe('ObsLogger structured records', () => {
  const logger = new ObsLogger();

  it('emits level, message, and fields with no trace when no span is active', () => {
    const rec = logger.record('info', 'hello', { userId: 7 });
    expect(rec.level).toBe('info');
    expect(rec.message).toBe('hello');
    expect(rec.userId).toBe(7);
    expect(typeof rec.time).toBe('string');
    expect(rec.trace_id).toBeUndefined();
  });
});

describe('ObsLogger trace correlation (real provider + in-memory exporter)', () => {
  const memory = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(memory)],
  });
  const logger = new ObsLogger();

  beforeAll(() => {
    provider.register();
  });
  afterAll(async () => {
    await provider.shutdown();
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
