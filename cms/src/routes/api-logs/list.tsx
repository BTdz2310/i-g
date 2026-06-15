import { useState } from 'react'
import { useApiLogs, ApiLog } from '@/hooks/use-api-logs'
import { JsonViewer } from '@/components/json-viewer'
import { fmtDate } from '@/lib/format'

const DIR_OPTIONS = [
  { value: '', label: 'Tất cả chiều' },
  { value: 'OUT_TO_PVI', label: 'OUT → PVI' },
  { value: 'IN_FROM_PARTNER', label: 'IN ← Partner' },
]

export default function ApiLogsPage() {
  const [filters, setFilters] = useState({
    direction: '',
    endpoint: '',
    maGiaodich: '',
    from: '',
    to: '',
  })
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useApiLogs({
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...(filters.endpoint ? { endpoint: filters.endpoint } : {}),
    ...(filters.maGiaodich ? { maGiaodich: filters.maGiaodich } : {}),
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
      <h1 className="text-xl font-semibold text-gray-900">API Logs</h1>

      <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-xl p-4">
        <select
          value={filters.direction}
          onChange={set('direction')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {DIR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Endpoint contains"
          value={filters.endpoint}
          onChange={set('endpoint')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-44"
        />
        <input
          placeholder="Mã GD"
          value={filters.maGiaodich}
          onChange={set('maGiaodich')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-36"
        />
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
              {['Chiều', 'Endpoint', 'Mã GD', 'Status', 'Thời gian', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-medium">
                  {h}
                </th>
              ))}
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
              items.map((log: ApiLog) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() =>
                      setExpandedId(expandedId === log.id ? null : log.id)
                    }
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          log.direction === 'OUT_TO_PVI'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {log.direction === 'OUT_TO_PVI' ? 'OUT' : 'IN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.endpoint}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {log.maGiaodich ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {log.statusCode != null && (
                        <span
                          className={`font-medium text-xs ${
                            log.statusCode < 300 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {fmtDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-blue-600 text-xs">
                      {expandedId === log.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <div className="flex gap-6">
                          <div className="flex-1">
                            <JsonViewer data={log.requestBody} label="Request Body" />
                          </div>
                          <div className="flex-1">
                            <JsonViewer data={log.responseBody} label="Response Body" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
    </div>
  )
}
