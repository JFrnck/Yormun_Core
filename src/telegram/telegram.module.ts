import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BudgetModule } from '../budget/budget.module';
import { HitlModule } from '../hitl/hitl.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [AuditModule, HitlModule, BudgetModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
