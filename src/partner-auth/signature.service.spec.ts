import { SignatureService } from './signature.service';

describe('SignatureService', () => {
  let svc: SignatureService;

  beforeEach(() => {
    svc = new SignatureService();
  });

  describe('sha256Hex', () => {
    it('returns hex of correct length', () => {
      expect(svc.sha256Hex(Buffer.from('hello'))).toHaveLength(64);
    });

    it('returns known hash for empty buffer', () => {
      expect(svc.sha256Hex(Buffer.from(''))).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    it('is deterministic', () => {
      const buf = Buffer.from('test');
      expect(svc.sha256Hex(buf)).toBe(svc.sha256Hex(buf));
    });
  });

  describe('hmacSha256Hex', () => {
    it('returns hex of correct length', () => {
      expect(svc.hmacSha256Hex('secret', 'message')).toHaveLength(64);
    });

    it('produces different results for different secrets', () => {
      const a = svc.hmacSha256Hex('secret1', 'message');
      const b = svc.hmacSha256Hex('secret2', 'message');
      expect(a).not.toBe(b);
    });

    it('produces different results for different messages', () => {
      const a = svc.hmacSha256Hex('secret', 'message1');
      const b = svc.hmacSha256Hex('secret', 'message2');
      expect(a).not.toBe(b);
    });
  });

  describe('buildCanonicalString', () => {
    it('joins parts with newline', () => {
      const result = svc.buildCanonicalString({
        method: 'POST',
        pathWithQuery: '/api/pvi/order',
        timestamp: '1700000000',
        nonce: 'abc123',
        bodyHash: 'deadbeef',
      });
      expect(result).toBe('POST\n/api/pvi/order\n1700000000\nabc123\ndeadbeef');
    });

    it('uppercases method', () => {
      const result = svc.buildCanonicalString({
        method: 'get',
        pathWithQuery: '/foo',
        timestamp: '1',
        nonce: 'n',
        bodyHash: 'h',
      });
      expect(result.startsWith('GET\n')).toBe(true);
    });
  });

  describe('timingSafeEqualsHex', () => {
    it('returns true for equal hex strings', () => {
      const h = svc.hmacSha256Hex('key', 'msg');
      expect(svc.timingSafeEqualsHex(h, h)).toBe(true);
    });

    it('returns false for different hex strings of same length', () => {
      const a = svc.hmacSha256Hex('key1', 'msg');
      const b = svc.hmacSha256Hex('key2', 'msg');
      expect(svc.timingSafeEqualsHex(a, b)).toBe(false);
    });

    it('returns false for different length strings', () => {
      expect(svc.timingSafeEqualsHex('abc', 'ab')).toBe(false);
    });
  });
});
