import type { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

export { ConfigModule } from './config.module';
export { EnvSchema, validateEnv, type Env } from './env.schema';

// Alias para inyectar con tipos estrictos: `@Inject(ConfigService)
// configService: AppConfigService`. El `true` fuerza a que `.get('X')`
// falle en tiempo de compilación si 'X' no existe en Env.
export type AppConfigService = ConfigService<Env, true>;
