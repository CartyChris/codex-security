import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '../../lib/auth'
import { SignOut } from '../../components/auth-form'
import styles from '../../components/account.module.css'
export const metadata = { title: 'Your workspace | OmniForge', description: 'Manage your secure OmniForge session.' }
export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  return <main className={styles.page}><Link href="/lab" className={styles.back}>← Security Lab</Link><section className={styles.card}><span className={styles.eyebrow}>AUTHENTICATED WORKSPACE</span><h1>Welcome, {session.user.name}.</h1><p>Signed in as {session.user.email}</p><p>Your session is verified on the server. GitHub account authorization and repository imports are the next setup stage; attaching the project connector alone does not grant this account repository access.</p><Link className={styles.primary} href="/lab">Open Security Lab</Link><SignOut /></section></main>
}
