import { useState } from 'react'
import { useTransactions, Transaction } from '@/hooks/use-transactions'
import { TxStatusBadge } from '@/components/status-badge'
import { fmtDate } from '@/lib/format'
import DetailSheet from './detail-sheet'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'SUBMITTING', label: 'Đang gửi' },
  { value: 'SUBMITTED_OK', label: 'Đã gửi OK' },
  { value: 'SUBMITTED_FAIL', label: 'Gửi lỗi' },
  { value: 'ISSUED', label: 'Đã cấp' },
  { value: 'CALLBACK_TIMEOUT', label: 'Timeout' },
]

export default function TransactionsPage() {
  const [filters, setFilters] = useState({
    status: '',
    maGiaodich: '',
    policyNumber: '',
    productKind: '',
    from: '',
    to: '',
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions({
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.maGiaodich ? { maGiaodich: filters.maGiaodich } : {}),
      ...(filters.policyNumber ? { policyNumber: filters.policyNumber } : {}),
      ...(filters.productKind ? { productKind: filters.productKind } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    })

  const items = data?.pages.flatMap((p) => p.items) ?? []

  const set =
    (k: keyof typeof filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Giao dịch</h1>

      <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-xl p-4">
        <select
          value={filters.status}
          onChange={set('status')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {(
          [
            { key: 'maGiaodich', placeholder: 'Mã GD' },
            { key: 'policyNumber', placeholder: 'Số hợp đồng' },
            { key: 'productKind', placeholder: 'Sản phẩm' },
          ] as const
        ).map(({ key, placeholder }) => (
          <input
            key={key}
            placeholder={placeholder}
            value={filters[key]}
            onChange={set(key)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-36"
          />
        ))}
        <input
          type="date"
          value={filters.from}
          onChange={set('from')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={set('to')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {['Mã GD', 'Trạng thái', 'Sản phẩm', 'Số HĐ', 'Đối tác', 'Tạo lúc'].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              items.map((tx: Transaction) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedId(tx.id)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{tx.maGiaodich}</td>
                  <td className="px-4 py-3">
                    <TxStatusBadge status={tx.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tx.productKind}</td>
                  <td className="px-4 py-3 text-gray-600">{tx.policyNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{tx.partner?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {fmtDate(tx.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {hasNextPage && (
          <div className="border-t border-gray-100 p-3 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-md bg-gray-100 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Đang tải…' : 'Tải thêm'}
            </button>
          </div>
        )}
      </div>

      <DetailSheet txId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
