import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Ledger, { type State } from './ledger'
import Auth from './components/Auth'
import { loadInitialState, makePersister, archivePeriod } from './lib/sync'

function Splash({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8a8175',
        fontFamily: "'Source Serif 4', serif",
        fontStyle: 'italic',
        fontSize: 20,
      }}
    >
      {label}
    </div>
  )
}

function AccountBar({ email }: { email: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        left: 12,
        fontSize: 12,
        color: '#b5ab9a',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <span>{email}</span>
      <span>·</span>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          background: 'none',
          border: 'none',
          color: '#b5ab9a',
          cursor: 'pointer',
          padding: 0,
          fontSize: 12,
          textDecoration: 'underline',
        }}
      >
        Sign out
      </button>
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

  if (session === undefined) return <Splash label="Loading…" />
  if (!session) return <Auth />
  if (!initial) return <Splash label="Loading your ledger…" />

  return (
    <>
      <Ledger
        key={userId}
        initialState={initial.state}
        onPersist={persist}
        userId={userId}
        onArchive={(row) => archivePeriod(userId, row)}
      />
      <AccountBar email={session.user.email ?? ''} />
    </>
  )
}
