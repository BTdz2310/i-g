import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Secret {
  id: number
  keyId: string
  status: string
  createdAt: string
}

export interface Partner {
  id: number
  name: string
  clientId: string
  status: string
  rateLimit: number
  allowedIps: string[]
  createdAt: string
  secrets: Secret[]
}

export function usePartners() {
  return useQuery<Partner[]>({
    queryKey: ['partners'],
    queryFn: () => api.get('/admin/partners').then((r) => r.data),
  })
}

export function useCreatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      clientId?: string
      rateLimit?: number
      allowedIps?: string
      status?: string
    }) =>
      api
        .post<{ id: number; clientId: string; keyId: string; secret: string }>(
          '/admin/partners',
          body,
        )
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function useUpdatePartner(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name?: string
      rateLimit?: number
      allowedIps?: string
      status?: string
    }) => api.patch(`/admin/partners/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function useRotateSecret(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (revokeOld: boolean) =>
      api
        .post<{ keyId: string; secret: string }>(`/admin/partners/${id}/rotate-secret`, {
          revokeOld,
        })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function useTogglePartnerStatus(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      api.patch(`/admin/partners/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}
