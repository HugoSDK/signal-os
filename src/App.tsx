import { useEffect, useMemo, useState } from 'react'
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

/** Sidebar wording for the set-aside copy. */
function backupLabel(b: { ts: string; undo: boolean }) {
  if (b.undo) return 'UNDO RESTORE'
  const d = new Date(b.ts)
  if (isNaN(+d)) return 'RESTORE COPY FROM THIS DEVICE'
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sameDay = d.toDateString() === new Date().toDateString()
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
  return 'RESTORE COPY FROM THIS DEVICE · ' + (sameDay ? time : day + ' ' + time)
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // `rev` identifies the board on screen: 0 for the one load() returned, then
  // one more each time another device's save replaces it (Ledger remounts with it).
  const [initial, setInitial] = useState<{ state: Partial<State> | null; rev: number } | null>(null)
  const [backup, setBackup] = useState<{ ts: string; undo: boolean } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const sync = useMemo(
    () => (userId ? createSync(userId, (state, rev) => setInitial({ state, rev })) : undefined),
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

  // A set-aside copy can appear whenever the board is replaced.
  useEffect(() => {
    setBackup(sync && initial ? sync.backup() : null)
  }, [sync, initial])

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

  const restore = async () => {
    if (!sync) return
    await sync.restore()
    setBackup(sync.backup())
  }
  const dismissBackup = () => {
    if (!sync) return
    sync.dismissBackup()
    setBackup(sync.backup())
  }

  if (session === undefined) return <Splash label="LOADING" />
  if (!session) return <Auth />
  if (!initial) return <Splash label="LOADING YOUR LEDGER" />

  return (
    <Ledger
      key={userId + ':' + initial.rev}
      initialState={initial.state}
      onPersist={(s) => sync?.persist(s, initial.rev)}
      onVisible={sync?.refresh}
      backup={backup ? { label: backupLabel(backup) } : null}
      onRestore={restore}
      onDismissBackup={dismissBackup}
      userId={userId}
      email={session.user.email ?? ''}
      onSignOut={() => supabase.auth.signOut()}
      onArchive={(row) => archivePeriod(userId, row)}
      onLoadHistory={fetchHistory}
    />
  )
}
