import { githubClient, githubFailure, githubResponse, githubUser } from '../../../../lib/github'

export async function GET(request: Request) {
  const user = await githubUser()
  if (!user) return githubResponse({ error: 'Sign in to connect your GitHub account.', signIn: true }, 401)
  const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) return githubResponse({ error: 'Invalid page.' }, 400)
  try {
    const github = await githubClient(user.id)
    const { data } = await github.repos.listForAuthenticatedUser({ per_page: 30, page, sort: 'updated' })
    return githubResponse({ repositories: data.map(repo => ({ id: repo.id, owner: repo.owner.login, name: repo.name, fullName: repo.full_name, private: repo.private, defaultBranch: repo.default_branch })), hasMore: data.length === 30 })
  } catch (error) { return githubFailure(error) }
}
