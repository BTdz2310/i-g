import { useState } from 'react'
import { usePartners, useTogglePartnerStatus, Partner } from '@/hooks/use-partners'
import { PartnerStatusBadge } from '@/components/status-badge'
import { fmtDate } from '@/lib/format'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import CreateDialog from './create-dialog'
import EditDialog from './edit-dialog'
import RotateDialog from './rotate-dialog'

export default function PartnersPage() {
  const { data: partners, isLoading } = usePartners()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [rotating, setRotating] = useState<Partner | null>(null)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Đối tác</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          Tạo partner
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {['Tên', 'Client ID', 'Trạng thái', 'Rate limit', 'Secrets', 'Tạo lúc', 'Hành động'].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : (partners ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {p.clientId}
                    </td>
                    <td className="px-4 py-3">
                      <PartnerStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.rateLimit}/s</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.secrets.filter((s) => s.status === 'ACTIVE').length} active
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {fmtDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditing(p)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => setRotating(p)}
                          className="text-xs text-orange-600 hover:underline"
                        >
                          Rotate
                        </button>
                        <ToggleButton partner={p} />
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {editing && <EditDialog partner={editing} onClose={() => setEditing(null)} />}
      {rotating && <RotateDialog partner={rotating} onClose={() => setRotating(null)} />}
    </div>
  )
}

function ToggleButton({ partner }: { partner: Partner }) {
  const toggle = useTogglePartnerStatus(partner.id)
  const isActive = partner.status === 'ACTIVE'

  const handleClick = async () => {
    try {
      await toggle.mutateAsync(isActive ? 'DISABLED' : 'ACTIVE')
      toast.success(`Đã ${isActive ? 'tắt' : 'bật'} partner`)
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={toggle.isPending}
      className={`text-xs hover:underline disabled:opacity-50 ${
        isActive ? 'text-red-600' : 'text-green-600'
      }`}
    >
      {isActive ? 'Tắt' : 'Bật'}
    </button>
  )
}
