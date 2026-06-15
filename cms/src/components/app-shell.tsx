import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  ScrollText,
  LogOut,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Giao dịch', icon: ArrowLeftRight },
  { to: '/partners', label: 'Đối tác', icon: Users },
  { to: '/api-logs', label: 'API Logs', icon: ScrollText },
]

export default function AppShell() {
  const { username, logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex w-56 flex-col bg-white border-r border-gray-200">
        <div className="px-4 py-5 border-b border-gray-200">
          <span className="text-lg font-bold text-blue-600">Insurance CMS</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <div className="mb-2 px-3 text-xs text-gray-500 truncate">{username}</div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={14} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
