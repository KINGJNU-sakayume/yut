/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages can serve this app either from a user/organization site
 * (`https://USERNAME.github.io/`) or from a project site
 * (`https://USERNAME.github.io/REPOSITORY/`). We never assume `/`:
 *
 * 1. `VITE_BASE` always wins (manual override, e.g. `VITE_BASE=/foo/`).
 * 2. Inside GitHub Actions, derive the base from `GITHUB_REPOSITORY`:
 *    - `owner/owner.github.io` → `/`
 *    - `owner/repo`            → `/repo/`
 * 3. Locally (dev server, local builds) use `/`.
 */
function resolveBase(): string {
  const override = process.env.VITE_BASE
  if (override) return override.endsWith('/') ? override : `${override}/`
  const repository = process.env.GITHUB_REPOSITORY
  if (process.env.GITHUB_ACTIONS === 'true' && repository) {
    const [owner, repo] = repository.split('/')
    if (!repo) return '/'
    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/'
    return `/${repo}/`
  }
  return '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
