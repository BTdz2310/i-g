import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PviConfig } from '../config/pvi.config';
import { SignService } from './sign.service';
import { AuditService } from '../audit/audit.service';
import { PviBusinessError } from '../common/errors/pvi-business.error';
import { maskSensitive } from '../common/logger/mask.util';
import { FeeInput, FeeResult } from './dto/fee.dto';
import { CreateOrderInput, CreateOrderResult } from './dto/create-order.dto';
import { CategoryInput, CategoryItem } from './dto/category.dto';
import { VehicleTypeInput, VehicleTypeItem } from './dto/vehicle-type.dto';
import { GetPolicyResult } from './dto/get-policy.dto';
import { FeeMotoInput, FeeMotoResult } from './dto/fee-moto.dto';
import { CreateMotoOrderInput, CreateMotoOrderResult } from './dto/create-order-moto.dto';

@Injectable()
export class PviClient {
  private readonly logger = new Logger(PviClient.name);

  constructor(
    private readonly cfg: PviConfig,
    private readonly sign: SignService,
    private readonly audit: AuditService,
    private readonly http: HttpService,
  ) {}

  async getFee(input: FeeInput): Promise<FeeResult> {
    const body = {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forGetFee({ ma_trongtai: input.ma_trongtai, so_cho: input.so_cho }),
    };
    const raw = await this.call(this.cfg.ep.getFee, body);
    return raw as FeeResult;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const body = {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forCreateOrder({ ma_giaodich: input.ma_giaodich }),
    };
    const raw = await this.call(this.cfg.ep.createOrder, body, input.ma_giaodich);
    return raw as CreateOrderResult;
  }

  async getCategory(input: CategoryInput): Promise<CategoryItem[]> {
    const body = {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forCategory(input),
    };
    const raw = await this.call(this.cfg.ep.category, body) as { Data: CategoryItem[] };
    return raw.Data ?? [];
  }

  async getVehicleType(input: VehicleTypeInput): Promise<VehicleTypeItem[]> {
    const body = {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forGetVehicleType(input),
    };
    const raw = await this.call(this.cfg.ep.getVehicleType, body) as { Data: VehicleTypeItem[] };
    return raw.Data ?? [];
  }

  async getMotoFee(input: FeeMotoInput): Promise<FeeMotoResult> {
    const body = {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forGetMotoFee({
        ngay_dau: input.ngay_dau,
        ngay_cuoi: input.ngay_cuoi,
        loai_xe: input.loai_xe,
      }),
    };
    const raw = await this.call(this.cfg.ep.getFeeMoto, body);
    return raw as FeeMotoResult;
  }

  async createMotoOrder(input: CreateMotoOrderInput): Promise<CreateMotoOrderResult> {
    const body = {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forCreateMotoOrder({
        bien_kiemsoat: input.bien_kiemsoat,
        email: input.email,
        so_dienthoai: input.so_dienthoai,
        nhan_hieu: input.nhan_hieu,
        loai_xe: input.loai_xe,
        nam_sanxuat: input.nam_sanxuat,
      }),
    };
    const raw = await this.call(this.cfg.ep.createOrderMoto, body, input.ma_giaodich);
    return raw as CreateMotoOrderResult;
  }

  async getPolicy(maGiaodich: string): Promise<GetPolicyResult> {
    const body = {
      RequestId: maGiaodich,
      CpId: this.cfg.cpId,
      Sign: this.sign.forGetPolicy({ RequestId: maGiaodich }),
    };
    const raw = await this.call(this.cfg.ep.getPolicy, body, maGiaodich);
    return raw as GetPolicyResult;
  }

  private async call(endpoint: string, body: unknown, maGiaodich?: string): Promise<unknown> {
    const url = this.cfg.baseUrl + endpoint;
    const start = Date.now();
    let statusCode = 599;
    let response: unknown;
    let errorMsg: string | undefined;

    try {
      const res = await firstValueFrom(
        this.http.post(url, body, { timeout: this.cfg.timeoutMs }),
      );
      statusCode = res.status;
      response = res.data;

      if (res.data?.Status !== '00') {
        throw new PviBusinessError(res.data?.Status ?? 'UNKNOWN', res.data?.Message ?? '');
      }
      return res.data;
    } catch (err) {
      if (err instanceof PviBusinessError) {
        errorMsg = err.message;
        throw err;
      }
      errorMsg = (err as Error).message;
      this.logger.error(`PVI call failed [${endpoint}]: ${errorMsg}`);
      throw err;
    } finally {
      const durationMs = Date.now() - start;
      await this.audit.logOut(
        endpoint,
        maskSensitive(body),
        maskSensitive(response),
        statusCode,
        durationMs,
        maGiaodich,
        errorMsg,
      ).catch((e) => this.logger.error('Failed to write audit log', e));
    }
  }
}
