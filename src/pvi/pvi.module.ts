import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PviClient } from './pvi.client';
import { SignService } from './sign.service';
import { PviConfig } from '../config/pvi.config';

@Module({
  imports: [HttpModule],
  providers: [PviConfig, SignService, PviClient],
  exports: [PviClient, SignService],
})
export class PviModule {}
