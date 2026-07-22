import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ChainVerificationService } from './chain-verification.service';

@Module({
  providers: [AuditService, ChainVerificationService],
  exports: [AuditService, ChainVerificationService],
})
export class AuditModule {}
