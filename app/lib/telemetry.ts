// Demo telemetry for the Monitoring view: a seeded random walk so charts look alive
// without a backend. The UI labels it as demo data next to the app's real activity.

export type Sample = { t: number; requests: number; blocked: number; errors: number; latency: number }

export function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function nextSample(previous: Sample | undefined, t: number, random: () => number): Sample {
  const hour = new Date(t).getHours()
  const daily = 0.75 + 0.35 * Math.sin(((hour - 8) / 24) * Math.PI * 2)
  const base = previous?.requests ?? 820
  const requests = Math.max(180, Math.round(base * 0.82 + 900 * daily * 0.18 + (random() - 0.5) * 140))
  const spike = random() > 0.93 ? 3 + random() * 4 : 1
  const blocked = Math.max(0, Math.round(requests * (0.018 + random() * 0.02) * spike))
  const errors = Math.max(0, Math.round(requests * (0.002 + random() * 0.006) * (spike > 1 ? 1.8 : 1)))
  const latency = Math.round(Math.max(60, (previous?.latency ?? 180) * 0.7 + (140 + random() * 90 + (spike > 1 ? 120 : 0)) * 0.3))
  return { t, requests, blocked, errors, latency }
}

export function seedHistory(points: number, stepMs: number, now = Date.now()) {
  const random = seeded(42)
  const samples: Sample[] = []
  for (let i = points - 1; i >= 0; i--) samples.push(nextSample(samples[samples.length - 1], now - i * stepMs, random))
  return samples
}

// Weekly activity heatmap (7 days x 24 hours), seeded so it is stable between visits.
export function weeklyHeatmap() {
  const random = seeded(7)
  return Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => {
    const work = hour >= 8 && hour <= 19 && day < 5 ? 1 : 0.35
    const night = hour >= 1 && hour <= 4 ? 0.6 + random() * 1.6 : 0
    return Math.round((work * 40 + night * 25 + random() * 18) * (day === 2 && hour === 3 ? 3 : 1))
  }))
}

export const endpoints = [
  { path: '/api/auth/login', hits: 1840 },
  { path: '/api/projects/:id', hits: 1275 },
  { path: '/wp-login.php', hits: 960 },
  { path: '/api/upload', hits: 610 },
  { path: '/.env', hits: 455 },
  { path: '/api/graphql', hits: 390 },
]

export const simulatedEvents = [
  { kind: 'blocked', text: 'WAF blocked SQL injection probe on /api/projects/:id' },
  { kind: 'auth', text: 'Burst of failed logins from a single ASN throttled' },
  { kind: 'blocked', text: 'Path traversal attempt on /api/upload rejected' },
  { kind: 'info', text: 'Dependency advisory feed refreshed' },
  { kind: 'blocked', text: 'Scanner fingerprint requesting /.env denied' },
  { kind: 'auth', text: 'MFA challenge issued for new device sign-in' },
  { kind: 'info', text: 'TLS certificate renewal check passed' },
  { kind: 'blocked', text: 'Rate limit applied to /api/graphql introspection' },
]
