import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface OverviewData {
  byStatus: { status: string; count: number }[]
  todayCount: number
  weekCount: number
  activePartners: number
}

export interface TimeseriesPoint {
  date: string
  count: number
}

export function useOverview() {
  return useQuery<OverviewData>({
    queryKey: ['stats', 'overview'],
    queryFn: () => api.get('/admin/stats/overview').then((r) => r.data),
  })
}

export function useTimeseries(days: 7 | 30 | 90) {
  return useQuery<TimeseriesPoint[]>({
    queryKey: ['stats', 'timeseries', days],
    queryFn: () =>
      api.get('/admin/stats/timeseries', { params: { days } }).then((r) => r.data),
  })
}
