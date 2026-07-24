import { Injectable } from '@nestjs/common';
import {
  type Counter,
  type Histogram,
  type MetricOptions,
  metrics,
} from '@opentelemetry/api';

/**
 * Ergonomic metrics over the OpenTelemetry API. `counter` and `histogram` return
 * cached instruments by name, so consumers get monotonic counters and value
 * distributions without touching the raw SDK or leaking duplicate instruments.
 */
@Injectable()
export class Metrics {
  // Cache instruments by name: OTel warns on (and coalesces) duplicate instruments
  // of the same name, and re-creating one per call is wasteful. Separate maps keep
  // a name usable for at most one instrument kind.
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  // Resolve the meter lazily per call: the service may be constructed before the
  // provider registers, and a cached meter would bind to the pre-registration one.
  private meter() {
    return metrics.getMeter('@reuseablebackend/observability');
  }

  /** A monotonic counter for `name`; the same name returns the same instrument. */
  counter(name: string, options?: MetricOptions): Counter {
    let instrument = this.counters.get(name);
    if (!instrument) {
      instrument = this.meter().createCounter(name, options);
      this.counters.set(name, instrument);
    }
    return instrument;
  }

  /** A histogram for `name`; the same name returns the same instrument. */
  histogram(name: string, options?: MetricOptions): Histogram {
    let instrument = this.histograms.get(name);
    if (!instrument) {
      instrument = this.meter().createHistogram(name, options);
      this.histograms.set(name, instrument);
    }
    return instrument;
  }
}
