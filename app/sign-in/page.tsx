import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '../../lib/auth'
import { AuthForm } from '../../components/auth-form'
import styles from '../../components/account.module.css'
export const metadata = { title: 'Sign in | OmniForge', description: 'Secure access to your OmniForge workspace.' }
export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/account')
  return <main className={styles.page}><Link href="/lab" className={styles.back}>← Back to Security Lab</Link><section className={styles.card}><span className={styles.eyebrow}>OMNIFORGE / YOUR WORKSPACE</span><h1>A space of your own.</h1><p>Sign in to establish your private workspace identity. Local source reviews remain available without an account.</p><AuthForm /></section></main>
}
