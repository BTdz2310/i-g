import {
  TX_STATUS_COLOR,
  TX_STATUS_LABEL,
  PARTNER_STATUS_COLOR,
  TxStatus,
  PartnerStatus,
} from '@/lib/format'

export function TxStatusBadge({ status }: { status: TxStatus | string }) {
  const color = TX_STATUS_COLOR[status as TxStatus] ?? 'bg-gray-100 text-gray-800'
  const label = TX_STATUS_LABEL[status as TxStatus] ?? status
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

export function PartnerStatusBadge({ status }: { status: PartnerStatus | string }) {
  const color = PARTNER_STATUS_COLOR[status as PartnerStatus] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu'}
    </span>
  )
}
