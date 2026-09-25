import { createClient } from '@supabase/supabase-js'

// Env vars are preferred; the fallbacks are the project's public config.
// The publishable (anon) key is safe to ship in the browser — Row-Level
// Security is what protects the data, so this can live in the bundle.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://tpodyjdynyexcgnlcsts.supabase.co'
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'sb_publishable_h-ifS5TX-WctHtzlyDV2zA_0_RhPhDf'

// Writes go out with `keepalive`, so a save started as the page is hidden or
// closed still completes. Browsers cap keepalive bodies at 64KB, so larger
// boards fall back to a normal request.
const KEEPALIVE_MAX = 60_000
const keepaliveFetch: typeof fetch = (input, init) => {
  const method = (init?.method || 'GET').toUpperCase()
  const body = init?.body
  if (method !== 'GET' && method !== 'HEAD' && typeof body === 'string' && new Blob([body]).size < KEEPALIVE_MAX) {
    return fetch(input, { ...init, keepalive: true })
  }
  return fetch(input, init)
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: keepaliveFetch },
})
