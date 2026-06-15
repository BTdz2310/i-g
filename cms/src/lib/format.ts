export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN')

export type TxStatus =
  | 'SUBMITTING'
  | 'SUBMITTED_OK'
  | 'SUBMITTED_FAIL'
  | 'ISSUED'
  | 'CALLBACK_TIMEOUT'

export type PartnerStatus = 'ACTIVE' | 'DISABLED'

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  SUBMITTING: 'Đang gửi',
  SUBMITTED_OK: 'Đã gửi OK',
  SUBMITTED_FAIL: 'Gửi lỗi',
  ISSUED: 'Đã cấp',
  CALLBACK_TIMEOUT: 'Timeout',
}

export const TX_STATUS_COLOR: Record<TxStatus, string> = {
  SUBMITTING: 'bg-yellow-100 text-yellow-800',
  SUBMITTED_OK: 'bg-blue-100 text-blue-800',
  SUBMITTED_FAIL: 'bg-red-100 text-red-800',
  ISSUED: 'bg-green-100 text-green-800',
  CALLBACK_TIMEOUT: 'bg-gray-100 text-gray-800',
}

export const PARTNER_STATUS_COLOR: Record<PartnerStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DISABLED: 'bg-red-100 text-red-800',
}
