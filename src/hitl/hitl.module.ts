import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DualConfirmService } from './dual-confirm.service';
import { TimeoutService } from './timeout.service';

@Module({
  imports: [AuditModule],
  providers: [DualConfirmService, TimeoutService],
  exports: [DualConfirmService, TimeoutService],
})
export class HitlModule {}
