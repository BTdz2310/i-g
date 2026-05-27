import { of, throwError } from 'rxjs';
import { PviClient } from './pvi.client';
import { PviBusinessError } from '../common/errors/pvi-business.error';

const makeCfg = () => ({
  baseUrl: 'https://pvi.example.com',
  cpId: 'CP001',
  ep: {
    getFee: '/getFee',
    createOrder: '/createOrder',
    category: '/getCategory',
    getVehicleType: '/getVehicleType',
    getPolicy: '/getPolicy',
  },
  timeoutMs: 5000,
});

const makeSign = () => ({
  forGetFee: jest.fn().mockReturnValue('sign-fee'),
  forCreateOrder: jest.fn().mockReturnValue('sign-order'),
  forCategory: jest.fn().mockReturnValue('sign-cat'),
  forGetVehicleType: jest.fn().mockReturnValue('sign-vt'),
  forGetPolicy: jest.fn().mockReturnValue('sign-pol'),
});

const makeAudit = () => ({ logOut: jest.fn().mockResolvedValue(undefined) });

const makeHttp = (data: any, status = 200) => ({
  post: jest.fn().mockReturnValue(of({ status, data })),
});

const makeClient = (httpData: any, status = 200) => {
  const cfg = makeCfg();
  const sign = makeSign();
  const audit = makeAudit();
  const http = makeHttp(httpData, status);
  const client = new PviClient(
    cfg as any,
    sign as any,
    audit as any,
    http as any,
  );
  return { client, cfg, sign, audit, http };
};

describe('PviClient', () => {
  describe('getFee', () => {
    it('calls PVI and returns result', async () => {
      const { client } = makeClient({ Status: '00', TotalFee: 500000 });
      const result = await client.getFee({
        ma_trongtai: 'TT',
        so_cho: 5,
      } as any);
      expect((result as any).TotalFee).toBe(500000);
    });

    it('includes CpId and Sign in request', async () => {
      const { client, http } = makeClient({ Status: '00' });
      await client.getFee({ ma_trongtai: 'TT', so_cho: 5 } as any);
      const body = http.post.mock.calls[0][1];
      expect(body.CpId).toBe('CP001');
      expect(body.Sign).toBe('sign-fee');
    });

    it('throws PviBusinessError when Status !== 00', async () => {
      const { client } = makeClient({
        Status: '-101',
        Message: 'Invalid data',
      });
      await expect(
        client.getFee({ ma_trongtai: 'TT', so_cho: 5 } as any),
      ).rejects.toBeInstanceOf(PviBusinessError);
    });

    it('writes audit log', async () => {
      const { client, audit } = makeClient({ Status: '00' });
      await client.getFee({ ma_trongtai: 'TT', so_cho: 5 } as any);
      expect(audit.logOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('createOrder', () => {
    it('returns order result', async () => {
      const { client } = makeClient({
        Status: '00',
        Pr_key: 123,
        URL_Payment: 'https://pay.pvi.com',
      });
      const result = await client.createOrder({ ma_giaodich: 'GD-001' } as any);
      expect((result as any).Pr_key).toBe(123);
    });

    it('passes maGiaodich to audit', async () => {
      const { client, audit } = makeClient({ Status: '00', Pr_key: 1 });
      await client.createOrder({ ma_giaodich: 'GD-001' } as any);
      expect(audit.logOut).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.anything(),
        expect.any(Number),
        expect.any(Number),
        'GD-001',
        undefined,
      );
    });
  });

  describe('getCategory', () => {
    it('returns Data array', async () => {
      const { client } = makeClient({
        Status: '00',
        Data: [{ Value: '1', Text: 'Xe con' }],
      });
      const result = await client.getCategory({ ten_dmuc: 'CAT' } as any);
      expect(result).toEqual([{ Value: '1', Text: 'Xe con' }]);
    });

    it('returns empty array when Data is undefined', async () => {
      const { client } = makeClient({ Status: '00' });
      const result = await client.getCategory({ ten_dmuc: 'CAT' } as any);
      expect(result).toEqual([]);
    });
  });

  describe('getVehicleType', () => {
    it('returns Data array', async () => {
      const { client } = makeClient({
        Status: '00',
        Data: [{ Value: 'LX01', Text: 'Xe con 4 chỗ' }],
      });
      const result = await client.getVehicleType({ SoChoNgoi: 4 } as any);
      expect(result).toEqual([{ Value: 'LX01', Text: 'Xe con 4 chỗ' }]);
    });
  });

  describe('getPolicy', () => {
    it('returns policy result', async () => {
      const { client } = makeClient({
        Status: '00',
        PolicyNumber: 'POL-001',
        SerialNumber: 'SN-001',
      });
      const result = await client.getPolicy('GD-001');
      expect((result as any).PolicyNumber).toBe('POL-001');
    });
  });

  describe('error handling', () => {
    it('logs and rethrows network errors', async () => {
      const cfg = makeCfg();
      const sign = makeSign();
      const audit = makeAudit();
      const http = {
        post: jest
          .fn()
          .mockReturnValue(throwError(() => new Error('ECONNREFUSED'))),
      };
      const client = new PviClient(
        cfg as any,
        sign as any,
        audit as any,
        http as any,
      );
      await expect(
        client.getFee({ ma_trongtai: 'TT', so_cho: 5 } as any),
      ).rejects.toThrow('ECONNREFUSED');
      expect(audit.logOut).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        undefined,
        599,
        expect.any(Number),
        undefined,
        'ECONNREFUSED',
      );
    });

    it('still writes audit log even when PviBusinessError thrown', async () => {
      const { client, audit } = makeClient({ Status: '-101', Message: 'Bad' });
      await expect(client.getPolicy('GD-001')).rejects.toBeInstanceOf(
        PviBusinessError,
      );
      expect(audit.logOut).toHaveBeenCalledTimes(1);
    });
  });
});
