import { Module } from '@nestjs/common';
import { SecretsModule } from '@reuseablebackend/secrets';

@Module({
  imports: [
    // The env provider is the Wave-1 default; requiredKeys are validated at boot.
    SecretsModule.forRootAsync({
      useFactory: () => ({
        requiredKeys: [],
      }),
    }),
  ],
})
export class AppModule {}
