import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { BudgetModule } from '../../budget/budget.module';
import { CanvasClientService } from './canvas-client.service';
import { CanvasToolsService } from './canvas-tools.service';
import { ShadowingService } from './shadowing.service';

@Module({
  imports: [AuditModule, BudgetModule],
  providers: [CanvasClientService, CanvasToolsService, ShadowingService],
  exports: [CanvasClientService, CanvasToolsService, ShadowingService],
})
export class CanvasModule {}
