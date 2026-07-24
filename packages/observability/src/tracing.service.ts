import { Injectable } from '@nestjs/common';
import { type Span, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Ergonomic tracing over the OpenTelemetry API. `withSpan` runs work inside a
 * new active span, records exceptions and sets an error status on throw, and
 * always ends the span — so consumers get correct spans without touching the
 * raw SDK.
 */
@Injectable()
export class Tracing {
  // Resolve the tracer lazily per call: the service may be constructed before the
  // provider registers, and a cached tracer would bind to the pre-registration one.
  private tracer() {
    return trace.getTracer('@reuseablebackend/observability');
  }

  /**
   * Run `fn` inside a new active span named `name`. On throw, the exception is
   * recorded and the span marked ERROR before rethrowing; the span is always ended.
   */
  async withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
    return this.tracer().startActiveSpan(name, async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /** The active trace id, or `undefined` outside a traced context or when sampling is off. */
  activeTraceId(): string | undefined {
    const id = trace.getActiveSpan()?.spanContext().traceId;
    return id && id !== '00000000000000000000000000000000' ? id : undefined;
  }
}
