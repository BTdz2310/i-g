import { NotFoundException } from '@nestjs/common';
import { PolicyController } from './policy.controller';

const makePrisma = (tx: any) => ({
  transaction: {
    findUnique: jest.fn().mockResolvedValue(tx),
    update: jest.fn().mockResolvedValue({}),
  },
});

const BASE_TX = {
  id: 'tx-1',
  maGiaodich: 'gd-001',
  partnerId: 'partner-1',
  status: 'SUBMITTED_OK',
  paymentUrl: 'https://pay.pvi.com',
  policyNumber: null,
  serialNumber: null,
  pdfUrl: null,
};

describe('PolicyController', () => {
  let mockPvi: any;

  beforeEach(() => {
    mockPvi = { getPolicy: jest.fn() };
  });

  it('throws NotFoundException when transaction not found', async () => {
    const ctrl = new PolicyController(makePrisma(null) as any, mockPvi);
    const req: any = { partner: { id: 'partner-1' } };
    await expect(ctrl.getPolicy(req, 'unknown')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when partnerId does not match', async () => {
    const ctrl = new PolicyController(makePrisma({ ...BASE_TX, partnerId: 'other' }) as any, mockPvi);
    const req: any = { partner: { id: 'partner-1' } };
    await expect(ctrl.getPolicy(req, 'gd-001')).rejects.toThrow(NotFoundException);
  });

  it('returns cached result for ISSUED transaction without calling PVI', async () => {
    const issuedTx = { ...BASE_TX, status: 'ISSUED', policyNumber: 'POL-001', serialNumber: 'SN-001', pdfUrl: 'https://pdf.pvi.com' };
    const ctrl = new PolicyController(makePrisma(issuedTx) as any, mockPvi);
    const result = await ctrl.getPolicy({ partner: { id: 'partner-1' } } as any, 'gd-001');
    expect(result.status).toBe('ISSUED');
    expect(result.policyNumber).toBe('POL-001');
    expect(mockPvi.getPolicy).not.toHaveBeenCalled();
  });

  it('returns status without calling PVI for SUBMITTED_FAIL', async () => {
    const ctrl = new PolicyController(makePrisma({ ...BASE_TX, status: 'SUBMITTED_FAIL' }) as any, mockPvi);
    const result = await ctrl.getPolicy({ partner: { id: 'partner-1' } } as any, 'gd-001');
    expect(result.status).toBe('SUBMITTED_FAIL');
    expect(result.policyNumber).toBeNull();
    expect(mockPvi.getPolicy).not.toHaveBeenCalled();
  });

  it('returns status without calling PVI for SUBMITTING', async () => {
    const ctrl = new PolicyController(makePrisma({ ...BASE_TX, status: 'SUBMITTING' }) as any, mockPvi);
    const result = await ctrl.getPolicy({ partner: { id: 'partner-1' } } as any, 'gd-001');
    expect(result.status).toBe('SUBMITTING');
    expect(mockPvi.getPolicy).not.toHaveBeenCalled();
  });

  it('polls PVI and returns ISSUED when policy available', async () => {
    mockPvi.getPolicy.mockResolvedValue({ PolicyNumber: 'POL-NEW', SerialNumber: 'SN-NEW', URL: 'https://pdf.pvi.com' });
    const prisma = makePrisma(BASE_TX);
    const ctrl = new PolicyController(prisma as any, mockPvi);
    const result = await ctrl.getPolicy({ partner: { id: 'partner-1' } } as any, 'gd-001');
    expect(result.status).toBe('ISSUED');
    expect(result.policyNumber).toBe('POL-NEW');
    expect(prisma.transaction.update).toHaveBeenCalled();
  });

  it('returns current status when PVI has no policy yet', async () => {
    mockPvi.getPolicy.mockResolvedValue({ PolicyNumber: null });
    const ctrl = new PolicyController(makePrisma(BASE_TX) as any, mockPvi);
    const result = await ctrl.getPolicy({ partner: { id: 'partner-1' } } as any, 'gd-001');
    expect(result.status).toBe('SUBMITTED_OK');
    expect(result.policyNumber).toBeNull();
  });

  it('swallows PVI errors and returns current status', async () => {
    mockPvi.getPolicy.mockRejectedValue(new Error('PVI down'));
    const ctrl = new PolicyController(makePrisma(BASE_TX) as any, mockPvi);
    const result = await ctrl.getPolicy({ partner: { id: 'partner-1' } } as any, 'gd-001');
    expect(result.status).toBe('SUBMITTED_OK');
  });

  it('allows access when no partnerId on request (admin/internal)', async () => {
    mockPvi.getPolicy.mockResolvedValue({ PolicyNumber: null });
    const ctrl = new PolicyController(makePrisma(BASE_TX) as any, mockPvi);
    const result = await ctrl.getPolicy({} as any, 'gd-001');
    expect(result.maGiaodich).toBe('gd-001');
  });
});
