import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { ConfigModule } from './config';
import { DbModule } from './db/db.module';
import { HitlModule } from './hitl/hitl.module';
import { CanvasModule } from './integrations/canvas/canvas.module';
import { ModelProviderModule } from './model-provider/model-provider.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    ScheduleModule.forRoot(),
    AuditModule,
    HitlModule,
    ModelProviderModule,
    CanvasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
