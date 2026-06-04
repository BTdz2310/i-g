import {
  StartNotInPastConstraint,
  parseVnDateTime,
  resolveGioDau,
  resolveNgayDauCombined,
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

describe('resolveGioDau', () => {
  it('giữ nguyên nếu gio != 00:00', () => {
    const future = fmt(Date.now() + 24 * 60 * 60 * 1000);
    expect(resolveGioDau(future.ngay, '14:30')).toBe('14:30');
  });

  it('trả "past" nếu ngày quá khứ + 00:00', () => {
    const yesterday = fmt(Date.now() - 24 * 60 * 60 * 1000);
    expect(resolveGioDau(yesterday.ngay, '00:00')).toBe('past');
  });

  it('trả "00:00" nếu ngày tương lai + 00:00', () => {
    const future = fmt(Date.now() + 48 * 60 * 60 * 1000);
    expect(resolveGioDau(future.ngay, '00:00')).toBe('00:00');
  });

  it('round-up lên giờ tiếp theo nếu ngày hôm nay + 00:00', () => {
    const todayVn = fmt(
      Math.floor((Date.now() + 7 * 60 * 60 * 1000) / 86_400_000) *
        86_400_000 -
        7 * 60 * 60 * 1000,
    );
    const result = resolveGioDau(todayVn.ngay, '00:00');
    expect(result).toMatch(/^\d{2}:00$/);
    expect(result).not.toBe('past');
  });

  it('trả lại nguyên xi nếu format ngày lỗi', () => {
    expect(resolveGioDau('2026-06-01', '00:00')).toBe('00:00');
  });
});

describe('resolveNgayDauCombined', () => {
  it('trả lại nguyên xi nếu format lỗi', () => {
    expect(resolveNgayDauCombined('invalid')).toBe('invalid');
  });

  it('trả "dd/MM/yyyy past" nếu ngày quá khứ', () => {
    const yesterday = fmt(Date.now() - 24 * 60 * 60 * 1000);
    expect(resolveNgayDauCombined(`${yesterday.ngay} 00:00`)).toBe(
      `${yesterday.ngay} past`,
    );
  });

  it('giữ nguyên 00:00 nếu ngày tương lai', () => {
    const future = fmt(Date.now() + 48 * 60 * 60 * 1000);
    expect(resolveNgayDauCombined(`${future.ngay} 00:00`)).toBe(
      `${future.ngay} 00:00`,
    );
  });

  it('không can thiệp nếu giờ != 00:00', () => {
    const future = fmt(Date.now() + 48 * 60 * 60 * 1000);
    expect(resolveNgayDauCombined(`${future.ngay} 14:30`)).toBe(
      `${future.ngay} 14:30`,
    );
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
