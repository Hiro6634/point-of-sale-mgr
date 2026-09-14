export const COLORS = [
  { name: 'yellow', bg: '#fef08a', dark: '#3b3a1e' },
  { name: 'green', bg: '#bbf7d0', dark: '#1e3a2b' },
  { name: 'cyan', bg: '#a5f3fc', dark: '#16343a' },
  { name: 'blue', bg: '#bfdbfe', dark: '#1e2f4a' },
  { name: 'purple', bg: '#ddd6fe', dark: '#2e2650' },
  { name: 'pink', bg: '#fbcfe8', dark: '#452233' },
  { name: 'orange', bg: '#fed7aa', dark: '#462f19' },
  { name: 'gray', bg: '#e5e7eb', dark: '#3f3f46' },
  { name: 'silver', bg: '#cbd5e1', dark: '#334155' },
  { name: 'red', bg: '#fecaca', dark: '#4c1d1d' },
  { name: 'white', bg: '#ffffff', dark: '#404040' },
]

export const colorBackground = (name, isDark = false) => {
  const color = COLORS.find((item) => item.name === name)
  if (!color) return ''
  return isDark ? color.dark : color.bg
}