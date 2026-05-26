import { Injectable } from '@nestjs/common';
import { getEnv } from './env';

export interface PviEndpoints {
  getFee: string;
  createOrder: string;
  category: string;
  getVehicleType: string;
  getPolicy: string;
  getFeeMoto: string;
  createOrderMoto: string;
}

@Injectable()
export class PviConfig {
  readonly baseUrl: string;
  readonly cpId: string;
  readonly key: string;
  readonly ep: PviEndpoints;
  readonly timeoutMs: number;

  constructor() {
    const env = getEnv();
    this.baseUrl = env.PVI_BASE_URL;
    this.cpId = env.PVI_CP_ID;
    this.key = env.PVI_KEY;
    this.timeoutMs = env.HTTP_TIMEOUT_MS;
    this.ep = {
      getFee: env.PVI_EP_GET_FEE,
      createOrder: env.PVI_EP_CREATE_ORDER,
      category: env.PVI_EP_CATEGORY,
      getVehicleType: env.PVI_EP_GET_VEHICLE_TYPE,
      getPolicy: env.PVI_EP_GET_POLICY,
      getFeeMoto: env.PVI_EP_GET_FEE_MOTO,
      createOrderMoto: env.PVI_EP_CREATE_ORDER_MOTO,
    };
  }
}
