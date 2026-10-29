'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '../lib/auth-client'
import styles from './account.module.css'

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      const credentials = { email: String(data.get('email')), password: String(data.get('password')) }
      const result = mode === 'login' ? await authClient.signIn.email(credentials) : await authClient.signUp.email({ ...credentials, name: String(data.get('name')) })
      if (result.error) { setError('Unable to continue. Check your details and try again.'); return }
      router.replace('/account'); router.refresh()
    } catch { setError('Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }
  return <form className={styles.form} onSubmit={submit}>
    <div className={styles.tabs}><button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setError('') }}>Sign in</button><button type="button" aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setError('') }}>Create account</button></div>
    {mode === 'register' && <label>Name<input name="name" autoComplete="name" required maxLength={100} disabled={busy} /></label>}
    <label>Email<input name="email" type="email" autoComplete="email" required disabled={busy} /></label>
    <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required disabled={busy} /></label>
    <p role="alert">{error}</p><button className={styles.primary} disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create your account'}</button>
  </form>
}

export function SignOut() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  return <><button className={styles.secondary} disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const result = await authClient.signOut(); if (result.error) throw new Error(); router.replace('/sign-in'); router.refresh() } catch { setError('Could not sign out. Please retry.') } finally { setBusy(false) } }}>{busy ? 'Signing out…' : 'Sign out'}</button><p role="alert">{error}</p></>
}
