import type { SecretKey, SecretProvider } from '../secret-provider';

/**
 * Wave-1 adapter: 12-factor secrets from process.env. Values live in the
 * deployment's env group (e.g. Render); this only reads them.
 */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  async get(key: SecretKey): Promise<string | undefined> {
    return this.source[key];
  }
}
