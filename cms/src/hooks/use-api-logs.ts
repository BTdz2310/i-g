import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ApiLog {
  id: number
  direction: string
  endpoint: string
  maGiaodich: string | null
  statusCode: number | null
  requestBody: unknown
  responseBody: unknown
  createdAt: string
}

export interface ApiLogFilters {
  direction?: string
  endpoint?: string
  maGiaodich?: string
  from?: string
  to?: string
  limit?: number
}

export function useApiLogs(filters: ApiLogFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['api-logs', filters],
    queryFn: ({ pageParam }) =>
      api
        .get<{ items: ApiLog[]; nextCursor: string | null }>('/admin/api-logs', {
          params: { ...filters, cursor: pageParam ?? undefined },
        })
        .then((r) => r.data),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })
}
