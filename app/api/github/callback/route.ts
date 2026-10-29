import { NextResponse } from 'next/server'
import { githubClient, githubOrigin, githubUser } from '../../../../lib/github'

export async function GET() {
  const user = await githubUser()
  const origin = await githubOrigin()
  if (!user) return NextResponse.redirect(`${origin}/sign-in`)
  try {
    await githubClient(user.id)
    return NextResponse.redirect(`${origin}/lab?github=connected`)
  } catch { return NextResponse.redirect(`${origin}/lab?github=authorization-required`) }
}
