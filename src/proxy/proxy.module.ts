import { Module } from '@nestjs/common';
import { PviModule } from '../pvi/pvi.module';
import { PartnerAuthModule } from '../partner-auth/partner-auth.module';
import { StorageModule } from '../storage/storage.module';
import { CatalogController } from './catalog.controller';
import { VehicleTypeController } from './vehicle-type.controller';
import { QuoteController } from './quote.controller';
import { OrderController } from './order.controller';
import { PolicyController } from './policy.controller';
import { QuoteMotoController } from './quote-moto.controller';
import { OrderMotoController } from './order-moto.controller';

@Module({
  imports: [PviModule, PartnerAuthModule, StorageModule],
  controllers: [
    CatalogController,
    VehicleTypeController,
    QuoteController,
    OrderController,
    PolicyController,
    QuoteMotoController,
    OrderMotoController,
  ],
})
export class ProxyModule {}
