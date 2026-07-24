/**
 * The PORT. The only abstraction in this package, justified because the secret
 * backend genuinely varies (env now; AWS Secrets Manager / Vault later).
 *
 * A SecretProvider knows how to fetch a raw secret value for a key. Swapping the
 * backend is one new adapter file + a config change — zero change to SecretsService
 * or its consumers.
 */

/** Keys the platform reads. Extend as components need more secrets. */
export type SecretKey = 'DATABASE_URL' | 'JWT_SECRET' | (string & {});

export interface SecretProvider {
  /** Return the secret for `key`, or `undefined` if the backend has no value. */
  get(key: SecretKey): Promise<string | undefined>;
}

/** DI token for the bound provider. */
export const SECRET_PROVIDER = Symbol('SECRET_PROVIDER');
