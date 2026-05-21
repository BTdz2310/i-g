import { CallbackController } from './callback.controller';

const VALID_PAYLOAD = {
  RequestId: 'gd-001',
  PolicyNumber: 'POL-001',
  SerialNumber: 'SN-001',
  URL: 'https://pdf.pvi.com/pol.pdf',
  Sign: 'validsign',
  CardId: 'CID-001',
  CpId: 'CP-001',
};

const makePrisma = (tx: any) => ({
  transaction: {
    findUnique: jest.fn().mockResolvedValue(tx),
    update: jest.fn().mockResolvedValue({}),
  },
});

const makeAudit = () => ({ logIn: jest.fn().mockResolvedValue(undefined) });

describe('CallbackController', () => {
  let mockSign: any;

  beforeEach(() => {
    mockSign = { verifyCallback: jest.fn().mockReturnValue(true) };
  });

  it('returns invalid sign response when signature fails', async () => {
    mockSign.verifyCallback.mockReturnValue(false);
    const ctrl = new CallbackController(mockSign, makePrisma(null) as any, makeAudit() as any);
    const result = await ctrl.handleCallback(VALID_PAYLOAD as any);
    expect(result).toEqual({ Status: '-105', Message: 'Invalid sign' });
  });

  it('returns not found response when transaction missing', async () => {
    const ctrl = new CallbackController(mockSign, makePrisma(null) as any, makeAudit() as any);
    const result = await ctrl.handleCallback(VALID_PAYLOAD as any);
    expect(result).toEqual({ Status: '-404', Message: 'Transaction not found' });
  });

  it('returns OK idempotently when already ISSUED with same policy number', async () => {
    const tx = { status: 'ISSUED', policyNumber: 'POL-001' };
    const prisma = makePrisma(tx);
    const ctrl = new CallbackController(mockSign, prisma as any, makeAudit() as any);
    const result = await ctrl.handleCallback(VALID_PAYLOAD as any);
    expect(result).toEqual({ Status: '00', Message: 'OK' });
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('updates transaction and returns OK on successful callback', async () => {
    const tx = { status: 'SUBMITTED_OK', policyNumber: null };
    const prisma = makePrisma(tx);
    const audit = makeAudit();
    const ctrl = new CallbackController(mockSign, prisma as any, audit as any);
    const result = await ctrl.handleCallback(VALID_PAYLOAD as any);
    expect(result).toEqual({ Status: '00', Message: 'OK' });
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ISSUED',
          policyNumber: 'POL-001',
        }),
      }),
    );
    expect(audit.logIn).toHaveBeenCalled();
  });

  it('re-issues when ISSUED with different policy number', async () => {
    const tx = { status: 'ISSUED', policyNumber: 'POL-OLD' };
    const prisma = makePrisma(tx);
    const ctrl = new CallbackController(mockSign, prisma as any, makeAudit() as any);
    const result = await ctrl.handleCallback(VALID_PAYLOAD as any);
    expect(result).toEqual({ Status: '00', Message: 'OK' });
    expect(prisma.transaction.update).toHaveBeenCalled();
  });
});
