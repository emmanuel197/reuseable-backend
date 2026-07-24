import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { z } from 'zod';
import { SECRET_PROVIDER, type SecretKey, type SecretProvider } from './secret-provider';
import { EnvSecretProvider } from './providers/env.provider';
import { SecretsService } from './secrets.service';

export interface SecretsModuleOptions {
  /** The backend adapter to bind. Defaults to the env provider (Wave-1). */
  provider?: SecretProvider;
  /** Keys that must be present at boot — validated with zod, fails fast if absent. */
  requiredKeys?: SecretKey[];
}

export interface SecretsModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<SecretsModuleOptions> | SecretsModuleOptions;
}

async function validateRequiredKeys(
  provider: SecretProvider,
  requiredKeys: SecretKey[] = [],
): Promise<void> {
  if (requiredKeys.length === 0) return;

  const entries = await Promise.all(
    requiredKeys.map(async (key) => [key, await provider.get(key)] as const),
  );
  const shape = Object.fromEntries(
    requiredKeys.map((key) => [key, z.string().min(1, `Missing required secret: ${key}`)]),
  );
  z.object(shape).parse(Object.fromEntries(entries));
}

@Global()
@Module({})
export class SecretsModule {
  static forRoot(options: SecretsModuleOptions = {}): DynamicModule {
    const provider = options.provider ?? new EnvSecretProvider();

    const providerFactory: Provider = {
      provide: SECRET_PROVIDER,
      useFactory: async () => {
        await validateRequiredKeys(provider, options.requiredKeys);
        return provider;
      },
    };

    return {
      module: SecretsModule,
      providers: [providerFactory, SecretsService],
      exports: [SecretsService],
    };
  }

  static forRootAsync(options: SecretsModuleAsyncOptions): DynamicModule {
    const providerFactory: Provider = {
      provide: SECRET_PROVIDER,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => {
        const resolved = await options.useFactory(...args);
        const provider = resolved.provider ?? new EnvSecretProvider();
        await validateRequiredKeys(provider, resolved.requiredKeys);
        return provider;
      },
    };

    return {
      module: SecretsModule,
      imports: options.imports ?? [],
      providers: [providerFactory, SecretsService],
      exports: [SecretsService],
    };
  }
}
