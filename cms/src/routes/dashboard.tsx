import { useState } from 'react'
import { useOverview, useTimeseries } from '@/hooks/use-stats'
import { TxStatusBadge } from '@/components/status-badge'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function DashboardPage() {
  const [days, setDays] = useState<7 | 30 | 90>(7)
  const { data: overview, isLoading: ovLoading } = useOverview()
  const { data: timeseries, isLoading: tsLoading } = useTimeseries(days)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Hôm nay" value={overview?.todayCount} loading={ovLoading} />
        <StatCard label="7 ngày" value={overview?.weekCount} loading={ovLoading} />
        <StatCard label="Partner active" value={overview?.activePartners} loading={ovLoading} />
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-2">Theo trạng thái</p>
          {ovLoading ? (
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div className="flex flex-wrap gap-1">
              {overview?.byStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-1">
                  <TxStatusBadge status={s.status} />
                  <span className="text-xs text-gray-600">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-700">Giao dịch theo ngày</p>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  days === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d} ngày
              </button>
            ))}
          </div>
        </div>
        {tsLoading ? (
          <div className="h-40 bg-gray-50 rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#gd)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string
  value?: number
  loading: boolean
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      )}
    </div>
  )
}
