import { useState } from 'react'
import { supabase } from '../lib/supabase'

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

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100%',
          background: '#f7f4ee',
          border: '1px solid #e0d9ca',
          boxShadow: '0 2px 16px rgba(60,50,30,0.08)',
          borderRadius: 4,
          padding: '40px 40px 36px',
        }}
      >
        <div style={{ fontSize: 15.2, fontWeight: 600, letterSpacing: '0.18em', color: '#8a8175' }}>
          SIGNAL — LEDGER
        </div>
        <h1
          style={{
            margin: '14px 0 6px',
            fontFamily: "'Source Serif 4', serif",
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#1c1917',
          }}
        >
          {sent ? 'Check your email' : 'Sign in'}
        </h1>

        {sent ? (
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: "'Source Serif 4', serif",
              fontStyle: 'italic',
              fontSize: 19,
              lineHeight: 1.5,
              color: '#8a8175',
            }}
          >
            We sent a magic link to <span style={{ color: '#1c1917' }}>{email}</span>. Open it on any
            device to sign in — your ledger syncs everywhere.
          </p>
        ) : (
          <form onSubmit={submit}>
            <p
              style={{
                margin: '10px 0 22px',
                fontFamily: "'Source Serif 4', serif",
                fontStyle: 'italic',
                fontSize: 19,
                lineHeight: 1.5,
                color: '#8a8175',
              }}
            >
              Enter your email and we'll send a magic link. No password.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoFocus
              className="uin ul"
              style={{
                width: '100%',
                fontSize: 20,
                color: '#1c1917',
                padding: '8px 0',
                marginBottom: 20,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--accent, #7c2d12)',
                color: '#f7f4ee',
                border: 'none',
                borderRadius: 4,
                padding: '12px 0',
                fontSize: 16,
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            {err && (
              <div style={{ marginTop: 12, fontSize: 14, color: '#b4462f' }}>{err}</div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
