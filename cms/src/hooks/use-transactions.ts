import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Transaction {
  id: number
  maGiaodich: string
  status: string
  productKind: string
  policyNumber: string | null
  partner: { id: number; name: string }
  createdAt: string
  updatedAt: string
}

export interface ApiCallLog {
  id: number
  direction: string
  endpoint: string
  requestBody: unknown
  responseBody: unknown
  statusCode: number | null
  createdAt: string
}

export interface TransactionDetail extends Transaction {
  apiCallLogs: ApiCallLog[]
  pdfUrl: string | null
  callbackPayload: unknown
}

export interface TxFilters {
  status?: string
  partnerId?: string
  policyNumber?: string
  maGiaodich?: string
  productKind?: string
  from?: string
  to?: string
  limit?: number
}

export function useTransactions(filters: TxFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    queryFn: ({ pageParam }) =>
      api
        .get<{ items: Transaction[]; nextCursor: string | null }>('/admin/transactions', {
          params: { ...filters, cursor: pageParam ?? undefined },
        })
        .then((r) => r.data),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useTransactionDetail(id: number | null) {
  return useQuery<TransactionDetail>({
    queryKey: ['transaction', id],
    queryFn: () => api.get(`/admin/transactions/${id}`).then((r) => r.data),
    enabled: id != null,
  })
}

export function useReconcile(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post(`/admin/transactions/${id}/reconcile`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transaction', id] })
    },
  })
}
