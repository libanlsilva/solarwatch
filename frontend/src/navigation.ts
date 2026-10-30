export type Section = 'overview' | 'history' | 'installation'

export function sectionFromHash(hash: string): Section {
  return hash === '#history' ? 'history' : hash === '#installation' ? 'installation' : 'overview'
}
