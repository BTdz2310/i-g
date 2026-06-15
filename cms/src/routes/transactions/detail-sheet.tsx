import { toast } from 'sonner'
import { useTransactionDetail, useReconcile } from '@/hooks/use-transactions'
import { TxStatusBadge } from '@/components/status-badge'
import { JsonViewer } from '@/components/json-viewer'
import { fmtDate } from '@/lib/format'
import { X, FileDown, RefreshCw } from 'lucide-react'

export default function DetailSheet({
  txId,
  onClose,
}: {
  txId: number | null
  onClose: () => void
}) {
  const { data: tx, isLoading } = useTransactionDetail(txId)
  const reconcile = useReconcile(txId!)

  if (!txId) return null

  const handleReconcile = async () => {
    try {
      await reconcile.mutateAsync()
      toast.success('Reconcile thành công')
    } catch {
      toast.error('Reconcile thất bại')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900">Chi tiết giao dịch</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : tx ? (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Mã GD" value={tx.maGiaodich} mono />
              <Field label="Trạng thái" value={<TxStatusBadge status={tx.status} />} />
              <Field label="Sản phẩm" value={tx.productKind} />
              <Field label="Số HĐ" value={tx.policyNumber ?? '—'} />
              <Field label="Đối tác" value={tx.partner?.name ?? '—'} />
              <Field label="Tạo lúc" value={fmtDate(tx.createdAt)} />
            </div>

            <div className="flex gap-2">
              {(tx.status === 'ISSUED' || tx.policyNumber) && tx.pdfUrl && (
                <a
                  href={tx.pdfUrl}
                  download
                  className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                >
                  <FileDown size={14} />
                  Tải PDF
                </a>
              )}
              <button
                onClick={handleReconcile}
                disabled={reconcile.isPending}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={reconcile.isPending ? 'animate-spin' : ''}
                />
                Reconcile
              </button>
            </div>

            {tx.callbackPayload != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500 uppercase">
                  Callback Payload
                </p>
                <JsonViewer data={tx.callbackPayload} label="callback" />
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase">
                API Call Logs
              </p>
              <div className="space-y-2">
                {tx.apiCallLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-gray-200 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          log.direction === 'OUT_TO_PVI'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {log.direction}
                      </span>
                      <span className="font-mono text-gray-700">{log.endpoint}</span>
                      {log.statusCode && (
                        <span
                          className={`ml-auto font-medium ${
                            log.statusCode < 300 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400">{fmtDate(log.createdAt)}</p>
                    <JsonViewer data={log.requestBody} label="Request" />
                    <JsonViewer data={log.responseBody} label="Response" />
                  </div>
                ))}
                {tx.apiCallLogs.length === 0 && (
                  <p className="text-gray-400">Không có log</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}
