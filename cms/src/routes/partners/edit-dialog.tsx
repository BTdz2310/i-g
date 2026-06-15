import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useUpdatePartner, Partner } from '@/hooks/use-partners'
import { X } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1),
  rateLimit: z.coerce.number().optional(),
  allowedIps: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']),
})
type Form = z.infer<typeof schema>

const INPUT =
  'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none'

export default function EditDialog({
  partner,
  onClose,
}: {
  partner: Partner
  onClose: () => void
}) {
  const update = useUpdatePartner(partner.id)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: partner.name,
      rateLimit: partner.rateLimit,
      allowedIps: partner.allowedIps?.join(', '),
      status: partner.status as 'ACTIVE' | 'DISABLED',
    },
  })

  const onSubmit = async (values: Form) => {
    try {
      await update.mutateAsync(values)
      toast.success('Cập nhật thành công')
      onClose()
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Sửa partner: {partner.name}</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
            <input {...register('name')} className={INPUT} />
            {errors.name && (
              <p className="text-xs text-red-600 mt-0.5">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rate limit (req/s)
            </label>
            <input {...register('rateLimit')} type="number" className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allowed IPs
            </label>
            <input {...register('allowedIps')} className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trạng thái
            </label>
            <select {...register('status')} className={INPUT}>
              <option value="ACTIVE">Hoạt động</option>
              <option value="DISABLED">Vô hiệu</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 py-2 text-sm hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
