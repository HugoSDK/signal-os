import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Ledger, { type State } from './ledger'
import Auth from './components/Auth'
import { C, MONO, css } from './components/ui'
import { loadInitialState, makePersister, archivePeriod, loadHistory } from './lib/sync'

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
  const [initial, setInitial] = useState<{ state: Partial<State> | null } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) {
      setInitial(null)
      return
    }
    let cancelled = false
    setInitial(null)
    loadInitialState(userId).then((st) => {
      if (!cancelled) setInitial({ state: st })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const persist = useMemo(() => (userId ? makePersister(userId) : undefined), [userId])
  // Stable identity: Ledger refetches the archive whenever this prop changes.
  const fetchHistory = useMemo(() => (userId ? () => loadHistory(userId) : undefined), [userId])

  if (session === undefined) return <Splash label="LOADING" />
  if (!session) return <Auth />
  if (!initial) return <Splash label="LOADING YOUR LEDGER" />

  return (
    <Ledger
      key={userId}
      initialState={initial.state}
      onPersist={persist}
      userId={userId}
      email={session.user.email ?? ''}
      onSignOut={() => supabase.auth.signOut()}
      onArchive={(row) => archivePeriod(userId, row)}
      onLoadHistory={fetchHistory}
    />
  )
}
