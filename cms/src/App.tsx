import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import RequireAuth from '@/components/require-auth'
import AppShell from '@/components/app-shell'
import LoginPage from '@/routes/login'
import DashboardPage from '@/routes/dashboard'
import TransactionsPage from '@/routes/transactions/list'
import PartnersPage from '@/routes/partners/list'
import ApiLogsPage from '@/routes/api-logs/list'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/api-logs" element={<ApiLogsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
