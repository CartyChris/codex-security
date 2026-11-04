const themeScript = `try {
  const theme = localStorage.getItem('omniforge-theme');
  const accent = localStorage.getItem('omniforge-accent');
  if (['light', 'dark', 'system'].includes(theme)) document.documentElement.dataset.theme = theme;
  if (['violet', 'teal', 'blue', 'coral'].includes(accent)) document.documentElement.dataset.accent = accent;
  document.documentElement.dataset.compact = String(localStorage.getItem('omniforge-compact') === 'true');
} catch {}`

export default function WorkspaceTheme() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />
}
