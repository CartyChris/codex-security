import 'server-only'
import { getToken, UserAuthorizationRequiredError, NoValidTokenError, ConnectorInstallationRequiredError } from '@vercel/connect'
import { Octokit } from '@octokit/rest'
import { headers } from 'next/headers'
import { auth } from './auth'

export const githubConnector = 'github/omniforge-repository-imports'
export const githubParams = (id: string) => ({ subject: { type: 'user' as const, id }, scopes: ['contents:read', 'metadata:read'] })
export async function githubUser() { return (await auth.api.getSession({ headers: await headers() }))?.user }
export async function githubClient(id: string) {
  const token = await getToken(githubConnector, githubParams(id), { forceRefresh: true })
  return new Octokit({ auth: token, request: { timeout: 20000 } })
}
export function githubResponse(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
export function githubFailure(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
  if (error instanceof UserAuthorizationRequiredError || error instanceof NoValidTokenError || error instanceof ConnectorInstallationRequiredError || status === 401) return githubResponse({ error: 'Authorize GitHub to read your repositories.', authorize: true }, 403)
  if (status === 403 || status === 429) return githubResponse({ error: 'GitHub denied this request or its rate limit was reached. Check repository access and try again later.' }, 403)
  if (status === 404) return githubResponse({ error: 'Repository or revision not found, or access is unavailable.' }, 404)
  return githubResponse({ error: 'GitHub could not complete this request. Please retry.' }, 503)
}
export async function githubOrigin() {
  if (process.env.NODE_ENV !== 'production' && process.env.V0_RUNTIME_URL) return new URL(process.env.V0_RUNTIME_URL).origin
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`
}
export function validGithubOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return !!origin && [new URL(request.url).origin, ...auth.options.trustedOrigins, auth.options.baseURL].includes(origin)
}
