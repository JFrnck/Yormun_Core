import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AppConfigService } from '../config';
import * as schema from './schema';

export const DB_POOL = Symbol('DB_POOL');
export const DB_CONNECTION = Symbol('DB_CONNECTION');
export type Db = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (configService: AppConfigService): Pool =>
        new Pool({ connectionString: configService.get('DATABASE_URL') }),
    },
    {
      provide: DB_CONNECTION,
      inject: [DB_POOL],
      useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
    },
  ],
  exports: [DB_CONNECTION],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
