import { Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured JSON logger that auto-correlates each line with the active trace
 * (injecting `trace_id` / `span_id` from the current span). Emits to stdout/stderr
 * — 12-factor logs the collector scrapes; no vendor coupling.
 */
@Injectable()
export class ObsLogger {
  debug(message: string, fields?: Record<string, unknown>): void {
    this.emit('debug', message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.emit('info', message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.emit('warn', message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.emit('error', message, fields);
  }

  /** Build the structured record with active-trace correlation. Exposed for testing. */
  record(level: LogLevel, message: string, fields?: Record<string, unknown>): Record<string, unknown> {
    const ctx = trace.getActiveSpan()?.spanContext();
    return {
      time: new Date().toISOString(),
      level,
      message,
      ...(ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {}),
      ...(fields ?? {}),
    };
  }

  private emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    const line = `${JSON.stringify(this.record(level, message, fields))}\n`;
    if (level === 'error' || level === 'warn') process.stderr.write(line);
    else process.stdout.write(line);
  }
}
