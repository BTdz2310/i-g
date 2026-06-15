import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreatePartner } from '@/hooks/use-partners'
import { Copy, Check, X } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Nhập tên'),
  clientId: z.string().optional(),
  rateLimit: z.coerce.number().optional(),
  allowedIps: z.string().optional(),
})
type Form = z.infer<typeof schema>

const INPUT =
  'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none'

export default function CreateDialog({ onClose }: { onClose: () => void }) {
  const createPartner = useCreatePartner()
  const [secret, setSecret] = useState<{
    keyId: string
    secret: string
    clientId: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: Form) => {
    try {
      const res = await createPartner.mutateAsync(values)
      setSecret(res)
    } catch {
      toast.error('Tạo partner thất bại')
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret?.secret ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={!secret ? onClose : undefined}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            {secret ? 'Partner đã tạo' : 'Tạo partner mới'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {secret ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Lưu ngay thông tin bên dưới — secret sẽ không hiển thị lại!
            </div>
            <InfoField label="Client ID" value={secret.clientId} />
            <InfoField label="Key ID" value={secret.keyId} />
            <div>
              <p className="text-xs text-gray-500 mb-1">Secret</p>
              <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <code className="flex-1 text-xs break-all">{secret.secret}</code>
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <FormField label="Tên *" error={errors.name?.message}>
              <input
                {...register('name')}
                className={INPUT}
                placeholder="VD: Công ty ABC"
              />
            </FormField>
            <FormField label="Client ID (tự sinh nếu trống)">
              <input {...register('clientId')} className={INPUT} placeholder="auto" />
            </FormField>
            <FormField label="Rate limit (req/s)">
              <input
                {...register('rateLimit')}
                type="number"
                className={INPUT}
                placeholder="10"
              />
            </FormField>
            <FormField label="Allowed IPs (cách nhau bởi dấu phẩy)">
              <input
                {...register('allowedIps')}
                className={INPUT}
                placeholder="0.0.0.0/0"
              />
            </FormField>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-md bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Tạo
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <code className="text-sm text-gray-900">{value}</code>
    </div>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
