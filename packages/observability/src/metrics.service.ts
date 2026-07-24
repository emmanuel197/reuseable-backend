import { Injectable } from '@nestjs/common';
import {
  type Counter,
  type Histogram,
  type MetricOptions,
  metrics,
} from '@opentelemetry/api';

/** A cached instrument plus the options it was first created with, for conflict detection. */
interface Cached<T> {
  instrument: T;
  options?: MetricOptions;
}

/**
 * Ergonomic metrics over the OpenTelemetry API. `counter` and `histogram` return
 * cached instruments by name, so consumers get monotonic counters and value
 * distributions without touching the raw SDK or leaking duplicate instruments.
 */
@Injectable()
export class Metrics {
  // Cache instruments by name: OTel returns a fresh instrument object per call and
  // warns on duplicate registration, so caching gives stable identity and avoids the
  // churn. A name maps to at most one instrument kind.
  private readonly counters = new Map<string, Cached<Counter>>();
  private readonly histograms = new Map<string, Cached<Histogram>>();

  // Resolve the meter lazily per call: the service may be constructed before the
  // provider registers, and a cached meter would bind to the pre-registration one.
  private meter() {
    return metrics.getMeter('@reuseablebackend/observability');
  }

  /** A monotonic counter for `name`; the same name returns the same instrument. */
  counter(name: string, options?: MetricOptions): Counter {
    return this.resolve(this.counters, name, options, (m) => m.createCounter(name, options));
  }

  /** A histogram for `name`; the same name returns the same instrument. */
  histogram(name: string, options?: MetricOptions): Histogram {
    return this.resolve(this.histograms, name, options, (m) => m.createHistogram(name, options));
  }

  private resolve<T>(
    cache: Map<string, Cached<T>>,
    name: string,
    options: MetricOptions | undefined,
    create: (meter: ReturnType<Metrics['meter']>) => T,
  ): T {
    const hit = cache.get(name);
    if (hit) {
      // The cache would silently swallow a differing config (unit/description/advice)
      // on a re-request. Surface that at dev time instead of shipping a mislabelled
      // instrument; identical re-requests (or none) pass through unchanged.
      if (options && !sameOptions(hit.options, options)) {
        throw new Error(
          `Metric "${name}" already registered with different options; ` +
            `re-request it by name only or reuse the original definition.`,
        );
      }
      return hit.instrument;
    }
    const instrument = create(this.meter());
    cache.set(name, { instrument, options });
    return instrument;
  }
}

/** Shallow structural equality for MetricOptions (small, JSON-serialisable shapes). */
function sameOptions(a: MetricOptions | undefined, b: MetricOptions | undefined): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}
