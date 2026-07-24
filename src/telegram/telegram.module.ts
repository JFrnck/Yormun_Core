import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HitlModule } from '../hitl/hitl.module';
import { ModelProviderModule } from '../model-provider/model-provider.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [AuditModule, HitlModule, ModelProviderModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
