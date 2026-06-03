import {
  StartNotInPastConstraint,
  parseVnDateTime,
} from './start-not-in-past.validator';

const c = new StartNotInPastConstraint();
const check = (NgayDau: string, GioDau: string) =>
  c.validate(GioDau, { object: { NgayDau, GioDau } } as any);

// Format ngày VN từ một mốc Date theo giờ VN (UTC+7).
const fmt = (ms: number) => {
  const d = new Date(ms + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    ngay: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    gio: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
};

describe('parseVnDateTime', () => {
  it('parses a valid VN datetime to the correct UTC instant', () => {
    // 01/06/2026 00:00 giờ VN = 31/05/2026 17:00 UTC
    expect(parseVnDateTime('01/06/2026', '00:00')).toBe(
      Date.UTC(2026, 4, 31, 17, 0),
    );
  });

  it('rejects malformed input', () => {
    expect(parseVnDateTime('2026-06-01', '00:00')).toBeNull();
    expect(parseVnDateTime('01/06/2026', '0:0')).toBeNull();
  });

  it('rejects out-of-range and rolled-over dates', () => {
    expect(parseVnDateTime('32/01/2026', '00:00')).toBeNull();
    expect(parseVnDateTime('01/13/2026', '00:00')).toBeNull();
    expect(parseVnDateTime('31/02/2026', '00:00')).toBeNull();
    expect(parseVnDateTime('01/06/2026', '25:00')).toBeNull();
  });
});

describe('StartNotInPastConstraint', () => {
  it('rejects a start time in the past', () => {
    const past = fmt(Date.now() - 60 * 60 * 1000); // 1h trước
    expect(check(past.ngay, past.gio)).toBe(false);
  });

  it('accepts a start time in the future', () => {
    const future = fmt(Date.now() + 24 * 60 * 60 * 1000); // ngày mai
    expect(check(future.ngay, future.gio)).toBe(true);
  });

  it('does not double-report when format is invalid (handled by @Matches)', () => {
    expect(check('2026-06-01', '00:00')).toBe(true);
    expect(check('01/06/2026', 'xx:yy')).toBe(true);
  });
});
