export const getCsrf = (): string | undefined =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrf_token='))
    ?.split('=')[1]
