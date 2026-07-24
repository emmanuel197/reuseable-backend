import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Tracing } from '../src/tracing.service';

describe('Tracing service', () => {
  const memory = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(memory)] });
  const tracing = new Tracing();

  beforeAll(() => {
    trace.disable(); // clear any global provider leaked from another test file
    provider.register();
  });
  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
  });

  it('withSpan runs the work, returns its result, and records a span', async () => {
    const result = await tracing.withSpan('do-work', () => 42);
    expect(result).toBe(42);
    const span = memory.getFinishedSpans().find((s) => s.name === 'do-work');
    expect(span).toBeDefined();
    expect(span?.status.code).not.toBe(SpanStatusCode.ERROR);
  });

  it('activeTraceId is available inside a span and undefined outside', async () => {
    expect(tracing.activeTraceId()).toBeUndefined();
    const idInside = await tracing.withSpan('op', () => tracing.activeTraceId());
    expect(typeof idInside).toBe('string');
    expect(idInside).toHaveLength(32);
  });

  it('withSpan records the exception, marks the span ERROR, and rethrows', async () => {
    await expect(
      tracing.withSpan('boom', () => {
        throw new Error('kaboom');
      }),
    ).rejects.toThrow('kaboom');

    const span = memory.getFinishedSpans().find((s) => s.name === 'boom');
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.status.message).toBe('kaboom');
    expect(span?.events.some((e) => e.name === 'exception')).toBe(true);
  });

  it('records non-Error throwables as a string exception without losing the message', async () => {
    await expect(
      tracing.withSpan('string-throw', () => {
        throw 'plain string failure';
      }),
    ).rejects.toBe('plain string failure');

    const span = memory.getFinishedSpans().find((s) => s.name === 'string-throw');
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.status.message).toBe('plain string failure');
    const exception = span?.events.find((e) => e.name === 'exception');
    expect(exception?.attributes?.['exception.message']).toBe('plain string failure');
  });
});
