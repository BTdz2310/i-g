import { Module } from '@nestjs/common';
import { PviModule } from '../pvi/pvi.module';
import { CallbackController } from './callback.controller';

@Module({
  imports: [PviModule],
  controllers: [CallbackController],
})
export class CallbackModule {}
