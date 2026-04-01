import { state } from './state'
import type { Market } from './types'

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h`
  return `${h}h ${m}m`
}

export function formatUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatCompact(n: number): string {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return formatUSD(n)
}

export function truncAddr(a: string): string {
  return a.slice(0, 6) + '...' + a.slice(-4)
}

export function getMarket(): Market {
  return state.markets.find(m => m.id === state.selectedMarket) || state.markets[0]
}

export function getTotalPnl(): number {
  return state.positions.filter(p => p.status === 'open').reduce((sum, p) => sum + p.pnl, 0)
}

export function toast(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  const old = document.querySelector('.toast')
  if (old) old.remove()
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300) }, 2500)
}
