import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api'

type Status = 'loading' | 'authed' | 'unauthed'

interface AuthCtx {
  status: Status
  username: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

function parseMs(expiresIn: string): number {
  if (expiresIn.endsWith('m')) return parseInt(expiresIn) * 60_000
  if (expiresIn.endsWith('s')) return parseInt(expiresIn) * 1_000
  return 900_000
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [username, setUsername] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const scheduleRefresh = useCallback(
    (expiresIn: string) => {
      clearTimer()
      const ms = parseMs(expiresIn)
      const delay = Math.max(ms - 60_000, 10_000)
      timerRef.current = setTimeout(async () => {
        try {
          const res = await api.post<{ expiresIn: string }>('/admin/auth/refresh')
          scheduleRefresh(res.data.expiresIn)
        } catch {
          setStatus('unauthed')
          setUsername(null)
          navigate('/login')
        }
      }, delay)
    },
    [navigate],
  )

  useEffect(() => {
    api
      .get<{ adminId: number; username: string }>('/admin/auth/me')
      .then((res) => {
        setUsername(res.data.username)
        setStatus('authed')
        scheduleRefresh('15m')
      })
      .catch(() => setStatus('unauthed'))
  }, [scheduleRefresh])

  useEffect(() => {
    const onLogout = () => {
      clearTimer()
      setStatus('unauthed')
      setUsername(null)
      navigate('/login')
    }
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [navigate])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'authed') {
        api
          .post<{ expiresIn: string }>('/admin/auth/refresh')
          .then((res) => scheduleRefresh(res.data.expiresIn))
          .catch(() => {
            setStatus('unauthed')
            navigate('/login')
          })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status, navigate, scheduleRefresh])

  const login = async (u: string, p: string) => {
    const res = await api.post<{ username: string; expiresIn: string }>(
      '/admin/auth/login',
      { username: u, password: p },
    )
    setUsername(res.data.username)
    setStatus('authed')
    scheduleRefresh(res.data.expiresIn)
  }

  const logout = async () => {
    try {
      await api.post('/admin/auth/logout')
    } catch {
      // ignore
    }
    clearTimer()
    setStatus('unauthed')
    setUsername(null)
    navigate('/login')
  }

  return (
    <Ctx.Provider value={{ status, username, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
