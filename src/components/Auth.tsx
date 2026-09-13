import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, CornerTicks, Logo, MONO, css } from './ui'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setErr('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  const label = css(`font-family:${MONO};font-size:10px;letter-spacing:0.2em;color:${C.inkLabel2}`)

  return (
    <div
      style={css(
        `min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:${C.ground}`
      )}
    >
      <div
        style={css(
          `width:400px;max-width:100%;background:${C.surface};border:1px solid ${C.border};padding:34px 34px 30px;position:relative`
        )}
      >
        <CornerTicks />
        <div style={css('display:flex;align-items:center;gap:10px')}>
          <Logo size={22} faint />
          <span style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.22em;color:${C.inkLabel2}`)}>LEDGER</span>
        </div>
        <h1 style={css(`margin:22px 0 20px;font-size:31px;font-weight:500;letter-spacing:-0.02em;color:${C.ink}`)}>
          {sent ? 'Check your email' : 'Sign in'}
        </h1>

        {sent ? (
          <>
            <div style={label}>MAGIC LINK SENT</div>
            <div style={css(`margin-top:6px;font-size:16px;color:${C.inkBody};overflow-wrap:anywhere`)}>{email}</div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={label}>EMAIL</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoFocus
              className="uin ul-strong"
              style={css(`width:100%;font-size:18px;color:${C.ink};padding:7px 0;margin:4px 0 22px`)}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-pri"
              style={css('width:100%;padding:12px 0;font-size:11px;letter-spacing:0.18em')}
            >
              {loading ? 'SENDING…' : 'SEND MAGIC LINK'}
            </button>
            {err && <div style={css(`margin-top:12px;font-size:14px;color:${C.accent}`)}>{err}</div>}
          </form>
        )}
      </div>
    </div>
  )
}
