import axios from 'axios'
import { getCsrf } from './csrf'

export const api = axios.create({
  baseURL: '/',
  withCredentials: true,
})

const NO_CSRF_URLS = ['/admin/auth/login', '/admin/auth/refresh']
const CSRF_METHODS = ['post', 'patch', 'delete']

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase() ?? ''
  const url = config.url ?? ''
  if (CSRF_METHODS.includes(method) && !NO_CSRF_URLS.some((u) => url.endsWith(u))) {
    const csrf = getCsrf()
    if (csrf) config.headers['x-csrf-token'] = csrf
  }
  return config
})

let refreshPromise: Promise<void> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.endsWith('/admin/auth/refresh')
    ) {
      original._retry = true
      if (!refreshPromise) {
        refreshPromise = api
          .post('/admin/auth/refresh')
          .then(() => {})
          .catch(() => {
            window.dispatchEvent(new Event('auth:logout'))
            return Promise.reject(error)
          })
          .finally(() => {
            refreshPromise = null
          })
      }
      await refreshPromise
      return api(original)
    }
    return Promise.reject(error)
  },
)
