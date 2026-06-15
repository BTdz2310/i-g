import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function JsonViewer({ data, label }: { data: unknown; label?: string }) {
  const [open, setOpen] = useState(false)
  if (data == null) return <span className="text-gray-400 text-xs">null</span>

  let pretty: string
  try {
    pretty = JSON.stringify(typeof data === 'string' ? JSON.parse(data) : data, null, 2)
  } catch {
    pretty = String(data)
  }

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-blue-600 hover:underline"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label ?? 'JSON'}
      </button>
      {open && (
        <pre className="mt-1 rounded bg-gray-50 p-2 text-gray-700 overflow-auto max-h-64 border border-gray-200">
          {pretty}
        </pre>
      )}
    </div>
  )
}
