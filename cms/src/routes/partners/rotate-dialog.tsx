import { useState } from 'react'
import { toast } from 'sonner'
import { useRotateSecret, Partner } from '@/hooks/use-partners'
import { Copy, Check, X } from 'lucide-react'

export default function RotateDialog({
  partner,
  onClose,
}: {
  partner: Partner
  onClose: () => void
}) {
  const rotate = useRotateSecret(partner.id)
  const [revokeOld, setRevokeOld] = useState(false)
  const [result, setResult] = useState<{ keyId: string; secret: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleRotate = async () => {
    try {
      const res = await rotate.mutateAsync(revokeOld)
      setResult(res)
    } catch {
      toast.error('Rotate thất bại')
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(result?.secret ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={!result ? onClose : undefined}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Rotate Secret — {partner.name}</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Lưu ngay secret mới — sẽ không hiển thị lại!
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Key ID</p>
              <code className="text-sm">{result.keyId}</code>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Secret mới</p>
              <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <code className="flex-1 text-xs break-all">{result.secret}</code>
                <button
                  onClick={copySecret}
                  className="shrink-0 text-gray-500 hover:text-gray-700"
                >
                  {copied ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-md bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
            >
              Đã lưu, đóng
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Một secret mới sẽ được tạo cho partner{' '}
              <strong>{partner.name}</strong>.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={revokeOld}
                onChange={(e) => setRevokeOld(e.target.checked)}
                className="rounded"
              />
              Thu hồi secret cũ ngay lập tức
            </label>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-300 py-2 text-sm hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleRotate}
                disabled={rotate.isPending}
                className="flex-1 rounded-md bg-orange-600 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {rotate.isPending ? 'Đang xử lý…' : 'Rotate Secret'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
