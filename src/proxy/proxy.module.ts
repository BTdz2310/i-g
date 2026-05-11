import { Module } from '@nestjs/common';
import { PviModule } from '../pvi/pvi.module';
import { CatalogController } from './catalog.controller';
import { VehicleTypeController } from './vehicle-type.controller';
import { QuoteController } from './quote.controller';
import { OrderController } from './order.controller';
import { PolicyController } from './policy.controller';

@Module({
  imports: [PviModule],
  controllers: [
    CatalogController,
    VehicleTypeController,
    QuoteController,
    OrderController,
    PolicyController,
  ],
})
export class ProxyModule {}
