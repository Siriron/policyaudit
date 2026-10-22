// Mirrors the contract's own input rules so mistakes are caught before a wallet prompt. The contract still enforces them.
const NAME_CHARS = /^[A-Za-z0-9._-]+$/
const PATH_CHARS = /^[A-Za-z0-9._\-/]+$/

export function validRepo(repo: string): boolean {
  const parts = repo.split('/')
  if (parts.length !== 2 || repo.length > 140) return false
  return parts.every(p => p.length >= 1 && p.length <= 100 && p !== '.' && p !== '..' && NAME_CHARS.test(p))
}
export const validSha = (s: string) => /^[0-9a-f]{40}$/.test(s)
export function validPath(p: string): boolean {
  if (p.length < 1 || p.length > 200 || p.startsWith('/') || p.endsWith('/') || !PATH_CHARS.test(p)) return false
  return p.split('/').every(seg => seg !== '' && seg !== '.' && seg !== '..')
}
export const rawUrl = (repo: string, sha: string, path: string) =>
  `https://raw.githubusercontent.com/${repo}/${sha}/${path}`

export function looksLikeSecret(text: string): boolean {
  if (/(sk-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|AKIA|xoxb-|xoxp-|AIza)/.test(text)) return true
  if (text.includes('-----BEGIN') && text.includes('PRIVATE KEY')) return true
  return /[0-9a-fA-F]{64}/.test(text)
}

export const LIMITS = { name: 80, claim: 400, scenario: 1000, minLock: 7, maxLock: 90 }
