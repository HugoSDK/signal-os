import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Ledger, { type State } from './ledger'
import Auth from './components/Auth'
import { C, MONO, css } from './components/ui'
import { createSync, archivePeriod, loadHistory } from './lib/sync'

function Splash({ label }: { label: string }) {
  return (
    <div
      style={css(
        `min-height:100vh;display:flex;align-items:center;justify-content:center;background:${C.ground};` +
          `font-family:${MONO};font-size:10.5px;letter-spacing:0.22em;color:${C.inkLabel2}`
      )}
    >
      {label}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // `rev` bumps when another device's save replaces the board, remounting Ledger with it.
  const [initial, setInitial] = useState<{ state: Partial<State> | null; rev: number } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const sync = useMemo(
    () =>
      userId
        ? createSync(userId, (state) => setInitial((prev) => ({ state, rev: (prev?.rev ?? 0) + 1 })))
        : undefined,
    [userId]
  )

  useEffect(() => {
    if (!sync) {
      setInitial(null)
      return
    }
    let cancelled = false
    setInitial(null)
    sync.load().then((st) => {
      if (!cancelled) setInitial({ state: st, rev: 0 })
    })
    return () => {
      cancelled = true
    }
  }, [sync])

  // Save before the page goes away; pick up other devices' saves on return.
  // (Ledger refreshes on visibilitychange itself, before its day rollover.)
  useEffect(() => {
    if (!sync) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void sync.flush()
    }
    const onPageHide = () => void sync.flush()
    const onFocus = () => void sync.refresh()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('focus', onFocus)
    }
  }, [sync])

  // Stable identity: Ledger refetches the archive whenever this prop changes.
  const fetchHistory = useMemo(() => (userId ? () => loadHistory(userId) : undefined), [userId])

  if (session === undefined) return <Splash label="LOADING" />
  if (!session) return <Auth />
  if (!initial) return <Splash label="LOADING YOUR LEDGER" />

  return (
    <Ledger
      key={userId + ':' + initial.rev}
      initialState={initial.state}
      onPersist={sync?.persist}
      onVisible={sync?.refresh}
      userId={userId}
      email={session.user.email ?? ''}
      onSignOut={() => supabase.auth.signOut()}
      onArchive={(row) => archivePeriod(userId, row)}
      onLoadHistory={fetchHistory}
    />
  )
}
