import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Ledger, { type State } from './ledger'
import Auth from './components/Auth'
import { C, MONO, css } from './components/ui'
import { createSync, archivePeriod, loadHistory } from './lib/sync'
import { retireIfStale } from './lib/build'

/** How often a tab that is shown or focused checks for a newer build. */
const BUILD_CHECK_EVERY = 60_000

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
  // A board saved on another device (or merged after a lost race). Ledger
  // folds it into the open page in place; `seq` makes each one distinct.
  const [remoteBoard, setRemoteBoard] = useState<{ board: Partial<State>; seq: number } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const sync = useMemo(
    () => (userId ? createSync(userId, (board) => setRemoteBoard({ board, seq: ++seq.current })) : undefined),
    [userId]
  )

  useEffect(() => {
    if (!sync) {
      setInitial(null)
      return
    }
    let cancelled = false
    setInitial(null)
    setRemoteBoard(null)
    sync.load().then((st) => {
      if (!cancelled) setInitial({ state: st })
    })
    return () => {
      cancelled = true
    }
  }, [sync])

  // Save before the page goes away; on return, pick up other devices' saves
  // and retire this tab if a newer build is being served. (Ledger refreshes
  // on visibilitychange itself, before its day rollover.)
  useEffect(() => {
    if (!sync) return
    let lastCheck = 0
    const checkBuild = () => {
      const now = Date.now()
      if (now - lastCheck < BUILD_CHECK_EVERY) return
      lastCheck = now
      void retireIfStale(() => sync.flush())
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void sync.flush()
      else checkBuild()
    }
    const onPageHide = () => void sync.flush()
    const onFocus = () => {
      void sync.refresh()
      checkBuild()
    }
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
      key={userId}
      initialState={initial.state}
      remoteBoard={remoteBoard}
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
