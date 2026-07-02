import { createClient } from '@supabase/supabase-js'

// Env vars are preferred; the fallbacks are the project's public config.
// The publishable (anon) key is safe to ship in the browser — Row-Level
// Security is what protects the data, so this can live in the bundle.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://tpodyjdynyexcgnlcsts.supabase.co'
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'sb_publishable_h-ifS5TX-WctHtzlyDV2zA_0_RhPhDf'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
