// Khóa cần che khi ghi log để tuân thủ yêu cầu bảo mật PII của PVI
// (Biểu mẫu hạ tầng PVI mục 5.2 & 12 — dữ liệu cá nhân).
// So khớp không phân biệt hoa/thường để bắt cả biến thể camelCase/PascalCase.
//
// - Credential / chữ ký: Sign, CpId, Key, CardId, CpId
// - Định danh cá nhân: TenKH, TenChuXe, DiaChiKH, DiaChiChuXe, DienThoai,
//   EmailKH, BienKiemSoat, SoKhung, SoMay
const SENSITIVE_KEYS = new Set(
  [
    // credential / signature
    'sign',
    'cpid',
    'key',
    'cardid',
    'secret',
    'password',
    'token',
    'authorization',
    // PII khách hàng / chủ xe
    'tenkh',
    'tenchuxe',
    'tenth',
    'diachikh',
    'diachichuxe',
    'diachith',
    'dienthoai',
    'emailkh',
    'email',
    'bienkiemsoat',
    'sokhung',
    'somay',
  ].map((k) => k.toLowerCase()),
);

function isSafePropertyKey(key: string): boolean {
  return (
    key !== '__proto__' &&
    key !== 'constructor' &&
    key !== 'prototype' &&
    key !== 'toString' &&
    key !== 'valueOf' &&
    key !== 'hasOwnProperty'
  );
}

export function maskSensitive(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);

  const result = new Map<string, unknown>();

  for (const [k, v] of Object.entries(obj)) {
    if (!isSafePropertyKey(k)) {
      continue;
    }

    result.set(
      k,
      SENSITIVE_KEYS.has(k.toLowerCase()) ? '***' : maskSensitive(v),
    );
  }

  return Object.fromEntries(result);
}
