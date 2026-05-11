const SENSITIVE_KEYS = new Set(['Sign', 'CpId', 'Key', 'sign', 'cpId', 'key']);

export function maskSensitive(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.has(k) ? '***' : maskSensitive(v);
  }
  return result;
}
