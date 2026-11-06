import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'OmniForge Security Workspace', short_name: 'OmniForge', description: 'Evidence-led red, blue, and purple team source review.', start_url: '/', display: 'standalone', background_color: '#0b101b', theme_color: '#0b101b' }
}
