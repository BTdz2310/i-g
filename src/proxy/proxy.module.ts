import { Module } from '@nestjs/common';
import { PviModule } from '../pvi/pvi.module';
import { PartnerAuthModule } from '../partner-auth/partner-auth.module';
import { CatalogController } from './catalog.controller';
import { VehicleTypeController } from './vehicle-type.controller';
import { QuoteController } from './quote.controller';
import { OrderController } from './order.controller';
import { PolicyController } from './policy.controller';

@Module({
  imports: [PviModule, PartnerAuthModule],
  controllers: [
    CatalogController,
    VehicleTypeController,
    QuoteController,
    OrderController,
    PolicyController,
  ],
})
export class ProxyModule {}
