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

export function maskSensitive(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    // Skip dangerous prototype pollution keys
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      continue;
    }
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '***' : maskSensitive(v);
  }
  return result;
}
