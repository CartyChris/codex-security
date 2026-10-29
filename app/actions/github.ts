'use server'
import { startAuthorization } from '@vercel/connect'
import { githubConnector, githubOrigin, githubParams, githubUser } from '../../lib/github'

export async function authorizeGithub() {
  const user = await githubUser()
  if (!user) return { error: 'Sign in before connecting GitHub.' }
  try {
    const result = await startAuthorization(githubConnector, githubParams(user.id), { callbackUrl: `${await githubOrigin()}/api/github/callback` })
    return { url: result.url }
  } catch { return { error: 'Could not start GitHub authorization. Please retry.' } }
}
