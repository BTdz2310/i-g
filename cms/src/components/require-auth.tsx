import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export default function RequireAuth() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }
  if (status === 'unauthed') return <Navigate to="/login" replace />
  return <Outlet />
}
