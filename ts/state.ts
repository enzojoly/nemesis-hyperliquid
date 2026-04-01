import type { AppState } from './types'

export const state: AppState = {
  scene: 'title',
  introIndex: 0,
  introComplete: false,
  introStarted: false,
  connected: false,
  address: '',
  balance: 1250.00,
  nav: 'trade',
  orderTab: 'yes',
  posTab: 'positions',
  selectedMarket: '',
  showMarketModal: false,
  showDiagnosticPanel: false,
  avatarMode: 'full',
  currentEmotion: 'kawaii',
  currentDialogue: '',
  dialogueQueue: [],
  isTyping: false,
  typewriterIndex: 0,
  lastDialogueByCategory: {},
  markets: [],
  positions: [],
  orders: [],
  history: [],
  feed: [],
  leaderboard: [],
  stake: 100,
  targetAddress: '',
  processing: false,
  panelStates: { market: true, order: true, positions: true },
  marketFilter: 'all',
  particlesHtml: '',
  dialogueSignal: 'off',
  dialogueAtEnd: false,
  connectionState: 'CONNECTED',
  lastConnectionDialogue: 0,
}

export function initData() {
  const now = Date.now()
  state.markets = [
    { id: 'eth-3500', asset: 'ETH', question: 'ETH > $3,500', yesPrice: 0.42, noPrice: 0.58, volume: 284500, expiry: now + 24*3600000, category: 'crypto' },
    { id: 'btc-100k', asset: 'BTC', question: 'BTC > $100,000', yesPrice: 0.65, noPrice: 0.35, volume: 1250000, expiry: now + 7*24*3600000, category: 'crypto' },
    { id: 'sol-200', asset: 'SOL', question: 'SOL > $200', yesPrice: 0.38, noPrice: 0.62, volume: 156000, expiry: now + 48*3600000, category: 'crypto' },
    { id: 'hype-30', asset: 'HYPE', question: 'HYPE > $30', yesPrice: 0.28, noPrice: 0.72, volume: 89000, expiry: now + 12*3600000, category: 'crypto' },
  ]
  state.selectedMarket = state.markets[0].id
  state.positions = [
    { id: 'p1', marketId: 'eth-3500', market: 'ETH > $3,500', side: 'yes', size: 250, entry: 0.38, current: 0.42, pnl: 26.32, type: 'standard', status: 'open' },
    { id: 'p2', marketId: 'btc-100k', market: 'BTC > $100,000', side: 'no', size: 500, entry: 0.40, current: 0.35, pnl: 71.43, type: 'lobby', status: 'open' },
  ]
  state.orders = [{ id: 'o1', marketId: 'eth-3500', market: 'ETH > $3,500', side: 'yes', size: 100, price: 0.40, status: 'pending' }]
  state.history = [{ id: 'h1', marketId: 'hype-30', market: 'HYPE > $25', side: 'yes', size: 300, entry: 0.45, current: 1.00, pnl: 366.67, type: 'standard', status: 'closed' }]
  state.feed = [
    { user: '0xDegen.eth', text: '<span class="hl">DOMINATED</span> 0xNoob on <span class="market">ETH > $3,500</span> <span class="profit">+$420</span>', time: '2m ago' },
    { user: '0xWhale', text: 'Just opened a massive position on BTC. Here we go!', time: '5m ago' },
  ]
  state.leaderboard = [
    { rank: 1, address: '0x1234...5678', name: 'WhaleKing', pnl: 125420 },
    { rank: 2, address: '0x2345...6789', name: 'DegenMaster', pnl: 98340 },
    { rank: 3, address: '0x3456...7890', name: 'CryptoQueen', pnl: 87650 },
  ]
  state.particlesHtml = createParticles()
}

function createParticles(): string {
  let html = ''
  for (let i = 0; i < 15; i++) {
    const left = Math.random() * 100
    const delay = Math.random() * 15
    const duration = 15 + Math.random() * 10
    const size = 1 + Math.random() * 2
    html += `<div class="particle" style="left:${left}%;width:${size}px;height:${size}px;animation-delay:-${delay}s;animation-duration:${duration}s;"></div>`
  }
  return html
}
