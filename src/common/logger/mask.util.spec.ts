import { maskSensitive } from './mask.util';

describe('maskSensitive', () => {
  it('returns primitives unchanged', () => {
    expect(maskSensitive(42)).toBe(42);
    expect(maskSensitive('hello')).toBe('hello');
    expect(maskSensitive(null)).toBe(null);
    expect(maskSensitive(true)).toBe(true);
  });

  it('masks known sensitive keys', () => {
    const input = { sign: 'abc', cpid: 'x', key: 'secret', password: 'pw' };
    const result = maskSensitive(input) as Record<string, unknown>;
    expect(result.sign).toBe('***');
    expect(result.cpid).toBe('***');
    expect(result.key).toBe('***');
    expect(result.password).toBe('***');
  });

  it('masks PII keys', () => {
    const input = {
      TenKH: 'Nguyen Van A',
      DienThoai: '0901234567',
      EmailKH: 'test@example.com',
      BienKiemSoat: '51A-12345',
    };
    const result = maskSensitive(input) as Record<string, unknown>;
    expect(result.TenKH).toBe('***');
    expect(result.DienThoai).toBe('***');
    expect(result.EmailKH).toBe('***');
    expect(result.BienKiemSoat).toBe('***');
  });

  it('preserves non-sensitive keys', () => {
    const input = { ma_giaodich: 'TX-001', status: 'OK', amount: 100 };
    const result = maskSensitive(input) as Record<string, unknown>;
    expect(result.ma_giaodich).toBe('TX-001');
    expect(result.status).toBe('OK');
    expect(result.amount).toBe(100);
  });

  it('masks case-insensitively', () => {
    const result = maskSensitive({ TOKEN: 'abc', Secret: 'xyz' }) as Record<
      string,
      unknown
    >;
    expect(result.TOKEN).toBe('***');
    expect(result.Secret).toBe('***');
  });

  it('recurses into nested objects', () => {
    const input = { data: { sign: 'abc', name: 'ok' } };
    const result = maskSensitive(input) as any;
    expect(result.data.sign).toBe('***');
    expect(result.data.name).toBe('ok');
  });

  it('maps over arrays', () => {
    const input = [{ sign: 'abc' }, { name: 'ok' }];
    const result = maskSensitive(input) as any[];
    expect(result[0].sign).toBe('***');
    expect(result[1].name).toBe('ok');
  });

  it('handles empty object', () => {
    expect(maskSensitive({})).toEqual({});
  });
});
