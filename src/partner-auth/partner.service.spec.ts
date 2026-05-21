import { PartnerService } from './partner.service';

const makePrisma = () => ({
  partner: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  partnerSecret: {
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
  },
});

const makeSecretService = () => ({
  generateSecret: jest.fn().mockReturnValue('generated-hex-secret'),
  encrypt: jest.fn().mockReturnValue('encrypted-base64'),
  decrypt: jest.fn().mockReturnValue('decrypted-secret'),
});

describe('PartnerService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let secretService: ReturnType<typeof makeSecretService>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    secretService = makeSecretService();
  });

  describe('findActivePartnerByClientId', () => {
    it('returns null when partner not found', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);
      const svc = new PartnerService(prisma as any, secretService as any);
      expect(await svc.findActivePartnerByClientId('unknown')).toBeNull();
    });

    it('returns null when partner is INACTIVE', async () => {
      prisma.partner.findUnique.mockResolvedValue({ id: 'p1', status: 'INACTIVE' });
      const svc = new PartnerService(prisma as any, secretService as any);
      expect(await svc.findActivePartnerByClientId('cid')).toBeNull();
    });

    it('returns partner when ACTIVE', async () => {
      const partner = { id: 'p1', status: 'ACTIVE', clientId: 'cid', name: 'Test', rateLimit: 100, allowedIps: [] };
      prisma.partner.findUnique.mockResolvedValue(partner);
      const svc = new PartnerService(prisma as any, secretService as any);
      const result = await svc.findActivePartnerByClientId('cid');
      expect(result).toEqual(partner);
    });
  });

  describe('getActiveSecret', () => {
    it('returns null when secret not found', async () => {
      prisma.partnerSecret.findFirst.mockResolvedValue(null);
      const svc = new PartnerService(prisma as any, secretService as any);
      expect(await svc.getActiveSecret('p1', 'kid')).toBeNull();
    });

    it('decrypts and returns secret', async () => {
      prisma.partnerSecret.findFirst.mockResolvedValue({ secretEnc: 'enc-value' });
      const svc = new PartnerService(prisma as any, secretService as any);
      const result = await svc.getActiveSecret('p1', 'kid');
      expect(result).toBe('decrypted-secret');
      expect(secretService.decrypt).toHaveBeenCalledWith('enc-value');
    });
  });

  describe('createPartner', () => {
    it('creates partner with generated credentials', async () => {
      const partner = { id: 'p1', name: 'Test', clientId: 'cid', status: 'ACTIVE', rateLimit: 0, allowedIps: [] };
      prisma.partner.create.mockResolvedValue(partner);
      const svc = new PartnerService(prisma as any, secretService as any);
      const result = await svc.createPartner({ name: 'Test' });
      expect(result.partner).toEqual(partner);
      expect(result.secret).toBe('generated-hex-secret');
      expect(typeof result.keyId).toBe('string');
      expect(secretService.encrypt).toHaveBeenCalled();
    });
  });

  describe('rotateSecret', () => {
    it('returns null when partner not found', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);
      const svc = new PartnerService(prisma as any, secretService as any);
      expect(await svc.rotateSecret('unknown')).toBeNull();
    });

    it('creates new secret and returns keyId', async () => {
      prisma.partner.findUnique.mockResolvedValue({ id: 'p1' });
      const svc = new PartnerService(prisma as any, secretService as any);
      const result = await svc.rotateSecret('p1');
      expect(result?.secret).toBe('generated-hex-secret');
      expect(typeof result?.keyId).toBe('string');
      expect(prisma.partnerSecret.create).toHaveBeenCalled();
    });

    it('revokes old secrets when revokeOld=true', async () => {
      prisma.partner.findUnique.mockResolvedValue({ id: 'p1' });
      const svc = new PartnerService(prisma as any, secretService as any);
      await svc.rotateSecret('p1', true);
      expect(prisma.partnerSecret.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'REVOKED' } }),
      );
    });

    it('does not revoke when revokeOld=false', async () => {
      prisma.partner.findUnique.mockResolvedValue({ id: 'p1' });
      const svc = new PartnerService(prisma as any, secretService as any);
      await svc.rotateSecret('p1', false);
      expect(prisma.partnerSecret.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('updatePartner', () => {
    it('returns null when partner not found', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);
      const svc = new PartnerService(prisma as any, secretService as any);
      expect(await svc.updatePartner('unknown', { name: 'x' })).toBeNull();
    });

    it('updates only provided fields', async () => {
      prisma.partner.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.partner.update.mockResolvedValue({ id: 'p1', name: 'New Name' });
      const svc = new PartnerService(prisma as any, secretService as any);
      await svc.updatePartner('p1', { name: 'New Name' });
      const data = prisma.partner.update.mock.calls[0][0].data;
      expect(data.name).toBe('New Name');
      expect(data.rateLimit).toBeUndefined();
    });
  });

  describe('listPartners', () => {
    it('delegates to prisma', async () => {
      prisma.partner.findMany.mockResolvedValue([{ id: 'p1' }]);
      const svc = new PartnerService(prisma as any, secretService as any);
      const result = await svc.listPartners();
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });
});
