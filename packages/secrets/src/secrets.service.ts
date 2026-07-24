import { Inject, Injectable } from '@nestjs/common';
import { SECRET_PROVIDER, type SecretKey, type SecretProvider } from './secret-provider';

/**
 * The PUBLIC API consumers inject. Real work — typed access, a required() that
 * throws on missing, and a small read-through cache — not a pass-through wrapper.
 */
@Injectable()
export class SecretsService {
  private readonly cache = new Map<string, string>();

  constructor(@Inject(SECRET_PROVIDER) private readonly provider: SecretProvider) {}

  /**
   * Return the secret, or `undefined` if the backend has no value.
   *
   * Reads are cached for the process lifetime (the design calls for caching).
   * Trade-off: a rotated secret is not picked up until restart — call
   * `invalidate(key)` after a known rotation if you need the fresh value.
   */
  async get(key: SecretKey): Promise<string | undefined> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const value = await this.provider.get(key);
    if (value !== undefined) this.cache.set(key, value);
    return value;
  }

  /**
   * Return the secret or throw — for keys the app cannot start without.
   * Named to match `@nestjs/config`'s `ConfigService.getOrThrow`.
   */
  async getOrThrow(key: SecretKey): Promise<string> {
    const value = await this.get(key);
    if (value === undefined || value === '') {
      throw new Error(`Missing required secret: ${key}`);
    }
    return value;
  }

  /** Alias for {@link getOrThrow}. */
  async require(key: SecretKey): Promise<string> {
    return this.getOrThrow(key);
  }

  /** Drop a cached value so the next `get` re-reads the backend (e.g. after rotation). */
  invalidate(key: SecretKey): void {
    this.cache.delete(key);
  }
}
