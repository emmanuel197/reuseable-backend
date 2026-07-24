import { describe, expect, it } from 'vitest';
import { SecretsService } from '../src/secrets.service';
import { EnvSecretProvider } from '../src/providers/env.provider';

function makeService(env: NodeJS.ProcessEnv): SecretsService {
  return new SecretsService(new EnvSecretProvider(env));
}

describe('SecretsService against the env provider', () => {
  it('get() returns a present value', async () => {
    const svc = makeService({ JWT_SECRET: 'abc' });
    expect(await svc.get('JWT_SECRET')).toBe('abc');
  });

  it('get() returns undefined for a missing key', async () => {
    const svc = makeService({});
    expect(await svc.get('JWT_SECRET')).toBeUndefined();
  });

  it('getOrThrow() returns a present value', async () => {
    const svc = makeService({ DATABASE_URL: 'postgres://x' });
    expect(await svc.getOrThrow('DATABASE_URL')).toBe('postgres://x');
  });

  it('getOrThrow() throws on a missing key', async () => {
    const svc = makeService({});
    await expect(svc.getOrThrow('DATABASE_URL')).rejects.toThrow('Missing required secret: DATABASE_URL');
  });

  it('getOrThrow() throws on an empty value', async () => {
    const svc = makeService({ JWT_SECRET: '' });
    await expect(svc.getOrThrow('JWT_SECRET')).rejects.toThrow('Missing required secret: JWT_SECRET');
  });

  it('require() is an alias for getOrThrow()', async () => {
    const svc = makeService({ DATABASE_URL: 'postgres://x' });
    expect(await svc.require('DATABASE_URL')).toBe('postgres://x');
  });

  it('invalidate() forces a re-read of the backend', async () => {
    const env: NodeJS.ProcessEnv = { JWT_SECRET: 'first' };
    const svc = makeService(env);
    expect(await svc.get('JWT_SECRET')).toBe('first');
    env.JWT_SECRET = 'rotated';
    svc.invalidate('JWT_SECRET');
    expect(await svc.get('JWT_SECRET')).toBe('rotated');
  });

  it('caches reads (second get does not hit the backend)', async () => {
    const env: NodeJS.ProcessEnv = { JWT_SECRET: 'first' };
    const svc = makeService(env);
    expect(await svc.get('JWT_SECRET')).toBe('first');
    env.JWT_SECRET = 'changed';
    expect(await svc.get('JWT_SECRET')).toBe('first');
  });
});
