/* ------------------------------------------------------------------ *
 * Retire a tab that is running an older build than the site serves.   *
 * A tab left open across a deploy keeps its old code — and old code   *
 * may save the board in ways the current build no longer allows.      *
 * ------------------------------------------------------------------ */

/** The build a reload was last started for, so a served page that somehow
 * still runs the old entry can't reload forever. */
const KEY = 'signal_retire_target'
const ENTRY = /<script\b[^>]*\bsrc="([^"]*\/assets\/index-[^"]+\.js)"/

/** Path of this page's built entry module, or null outside a production build. */
export function runningEntry(): string | null {
  if (import.meta.env.DEV || typeof document === 'undefined') return null
  const el = document.querySelector('script[type="module"][src]')
  const src = el ? el.getAttribute('src') : null
  if (!src || !/\/assets\/index-[^/]+\.js$/.test(src)) return null
  return new URL(src, location.href).pathname
}

/** Entry module the server hands out right now, or null if that can't be told
 * (offline, an interstitial page, a template without a built entry). */
export async function servedEntry(): Promise<string | null> {
  const res = await fetch(import.meta.env.BASE_URL || '/', { cache: 'no-store', credentials: 'same-origin' })
  if (!res.ok) return null
  const m = (await res.text()).match(ENTRY)
  return m ? new URL(m[1], location.href).pathname : null
}

/**
 * Reload if a newer build is being served, after giving `flush` a moment to
 * push pending edits (they survive a reload anyway: the engine keeps them in
 * localStorage and merges them in on the next open). Resolves true when a
 * reload was started.
 */
export async function retireIfStale(flush: () => Promise<unknown>): Promise<boolean> {
  const running = runningEntry()
  if (!running) return false
  let served: string | null = null
  try {
    served = await servedEntry()
  } catch {
    return false
  }
  if (!served || served === running) return false
  let target: string | null = null
  try {
    target = sessionStorage.getItem(KEY)
  } catch {
    /* ignore */
  }
  if (target === served) {
    console.warn('build: still running', running, 'after reloading for', served)
    return false
  }
  try {
    sessionStorage.setItem(KEY, served)
  } catch {
    /* ignore */
  }
  console.info('build: a newer build is being served; reloading')
  await Promise.race([flush().catch(() => undefined), new Promise((r) => setTimeout(r, 4000))])
  location.reload()
  return true
}
