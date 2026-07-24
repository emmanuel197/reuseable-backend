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

/** Bind the given backend, or default to the env provider (Wave-1). */
function resolveProvider(provider?: SecretProvider): SecretProvider {
  return provider ?? new EnvSecretProvider();
}

/** Assemble the SecretsModule DynamicModule around a bound provider factory. */
function assembleModule(
  providerFactory: Provider,
  imports: DynamicModule['imports'] = [],
): DynamicModule {
  return {
    module: SecretsModule,
    imports,
    providers: [providerFactory, SecretsService],
    exports: [SecretsService],
  };
}

@Global()
@Module({})
export class SecretsModule {
  static forRoot(options: SecretsModuleOptions = {}): DynamicModule {
    const provider = resolveProvider(options.provider);

    const providerFactory: Provider = {
      provide: SECRET_PROVIDER,
      useFactory: async () => {
        await validateRequiredKeys(provider, options.requiredKeys);
        return provider;
      },
    };

    return assembleModule(providerFactory);
  }

  static forRootAsync(options: SecretsModuleAsyncOptions): DynamicModule {
    const providerFactory: Provider = {
      provide: SECRET_PROVIDER,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => {
        const resolved = await options.useFactory(...args);
        const provider = resolveProvider(resolved.provider);
        await validateRequiredKeys(provider, resolved.requiredKeys);
        return provider;
      },
    };

    return assembleModule(providerFactory, options.imports ?? []);
  }
}
