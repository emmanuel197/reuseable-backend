/**
 * BARREL — the only public surface of @reuseablebackend/secrets.
 * Providers stay internal; consumers wire a backend via SecretsModule options.
 */
export { SecretsModule } from './secrets.module';
export type {
  SecretsModuleOptions,
  SecretsModuleAsyncOptions,
} from './secrets.module';
export { SecretsService } from './secrets.service';
export {
  SECRET_PROVIDER,
  type SecretProvider,
  type SecretKey,
} from './secret-provider';
