import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  DataPointType,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { Metrics } from '../src/metrics.service';

describe('Metrics service', () => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter });
  const provider = new MeterProvider({ readers: [reader] });
  const svc = new Metrics();

  beforeAll(() => {
    metrics.disable(); // clear any global provider leaked from another test file
    metrics.setGlobalMeterProvider(provider);
  });
  afterAll(async () => {
    await provider.shutdown();
    metrics.disable();
  });

  /** Force a collection cycle and return the flat list of exported metric records. */
  async function collect() {
    await reader.forceFlush();
    return exporter.getMetrics().flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
  }

  it('counter records a monotonic sum', async () => {
    const requests = svc.counter('requests_total');
    requests.add(1);
    requests.add(2);

    const metric = (await collect()).find((m) => m.descriptor.name === 'requests_total');
    expect(metric?.dataPointType).toBe(DataPointType.SUM);
    expect(metric?.dataPoints.at(-1)?.value).toBe(3);
  });

  it('histogram records a value distribution', async () => {
    const latency = svc.histogram('request_latency_ms');
    latency.record(10);
    latency.record(30);

    const metric = (await collect()).find((m) => m.descriptor.name === 'request_latency_ms');
    expect(metric?.dataPointType).toBe(DataPointType.HISTOGRAM);
    const point = metric?.dataPoints.at(-1)?.value as { count: number; sum: number } | undefined;
    expect(point?.count).toBe(2);
    expect(point?.sum).toBe(40);
  });

  it('returns the same cached instrument for a repeated name', () => {
    expect(svc.counter('cached_total')).toBe(svc.counter('cached_total'));
    expect(svc.histogram('cached_dist')).toBe(svc.histogram('cached_dist'));
  });
});
