import morphdom from 'morphdom'
import { state } from './state'
import { ICONS } from './icons'
import { formatTime, formatUSD, formatCompact, getMarket } from './utils'
import { connectionMonitor } from './connection'

export function render() {
  const app = document.getElementById('app')
  if (!app) return

  const html = state.scene === 'title' ? renderTitleScreen() : renderMainInterface()

  morphdom(app, `<div id="app">${html}</div>`, {
    childrenOnly: true,
    onBeforeElUpdated: (fromEl: HTMLElement, toEl: HTMLElement) => {
      if (fromEl === document.activeElement && (fromEl.tagName === 'INPUT' || fromEl.tagName === 'TEXTAREA')) {
        return false
      }
      return true
    }
  })

  updateDialogueMask()
}

function renderTitleScreen(): string {
  return `
    <div class="scene" id="title-scene">
      <div class="bg-layer"></div>
      <div class="bg-shimmer"></div>
      <div class="bg-particles">${state.particlesHtml}</div>
      <div class="water-line"></div>
      <div class="title-screen">
        <div class="title-logo">NEMESIS</div>
        <div class="title-tagline">Every trader needs a Nemesis.</div>
        <div class="title-start">— Click to begin —</div>
      </div>
      <div class="dialogue-container">
        <div class="dialogue-box signal-${state.dialogueSignal}" id="dialogue-box">
          <div class="dialogue-name" id="dialogue-name">NEMESIS</div>
          <div class="dialogue-text" id="dialogue-text">${state.dialogueSignal === 'connected' ? state.currentDialogue : ''}</div>
          <div class="dialogue-continue">▼</div>
        </div>
        <div class="dialogue-orbital">
          <div class="orbital-ring orbital-ring-1"></div>
          <div class="orbital-ring orbital-ring-2"></div>
          <div class="orbital-ring orbital-ring-3"></div>
          <div class="orbital-core"></div>
        </div>
      </div>
    </div>
  `
}

function renderMainInterface(): string {
  return `
    <div class="scene" id="main-scene">
      <div class="bg-layer"></div>
      <div class="bg-shimmer"></div>
      <div class="bg-particles">${state.particlesHtml}</div>
      <div class="water-line"></div>
      <div class="main-interface">
        <header class="header">
          <div class="logo">
            <div class="logo-mark">${ICONS.logo}</div>
            <span class="logo-text">NEMESIS</span>
          </div>
          <nav class="nav">
            <button class="nav-btn ${state.nav === 'archive' ? 'active' : ''}" data-nav="archive">Archive</button>
            <button class="nav-btn ${state.nav === 'shop' ? 'active' : ''}" data-nav="shop">Shop All</button>
            <button class="nav-btn ${state.nav === 'returns' ? 'active' : ''}" data-nav="returns">Returns & Shipping</button>
          </nav>
          <div class="header-spacer"></div>
          <div class="mode-toggle">
            <button class="mode-btn ${state.avatarMode === 'full' ? 'active' : ''}" data-mode="full">Full</button>
            <button class="mode-btn ${state.avatarMode === 'small' ? 'active' : ''}" data-mode="small">Small</button>
          </div>
        </header>
        <div class="main-content">
          ${state.nav === 'shop' ? renderTradeContent() : ''}
          ${state.nav === 'archive' ? renderArchivePage() : ''}
          ${state.nav === 'returns' ? renderReturnsPage() : ''}
        </div>
      </div>
      ${renderConnectionIndicator()}
      ${renderDiagnosticPanel()}
      <div class="dialogue-container avatar-${state.avatarMode}">
        <div class="dialogue-box signal-${state.dialogueSignal}" id="dialogue-box">
          <div class="dialogue-name visible" id="dialogue-name">NEMESIS</div>
          <div class="dialogue-text" id="dialogue-text">${state.dialogueSignal === 'connected' ? state.currentDialogue : ''}</div>
          <div class="dialogue-continue">▼</div>
        </div>
        <div class="dialogue-portrait ${state.avatarMode === 'small' ? 'visible' : ''}" id="dialogue-portrait">
          <img id="portrait-img" src="nemesis-chan/${state.currentEmotion}.png" alt="">
        </div>
        <div class="dialogue-orbital">
          <div class="orbital-ring orbital-ring-1"></div>
          <div class="orbital-ring orbital-ring-2"></div>
          <div class="orbital-ring orbital-ring-3"></div>
          <div class="orbital-core"></div>
        </div>
      </div>
      ${state.showMarketModal ? renderMarketModal() : ''}
    </div>
  `
}

function renderTradeContent(): string {
  const m = getMarket()
  const timeLeft = m.expiry - Date.now()
  const price = state.orderTab === 'no' ? m.noPrice : m.yesPrice
  const payout = state.stake / price
  const profit = payout - state.stake
  const isLobby = state.orderTab === 'lobby'
  const isDuel = state.orderTab === 'duel'
  const openCount = state.positions.filter(p => p.status === 'open').length
  const orderCount = state.orders.filter(o => o.status === 'pending').length

  let posContent = ''
  if (state.posTab === 'positions') {
    const open = state.positions.filter(p => p.status === 'open')
    posContent = open.length === 0 ? '<div class="empty">No open positions</div>' :
      open.map(p => `<div class="pos-item" data-id="${p.id}"><div class="pos-header"><span class="pos-market">${p.market}</span><span class="pos-side ${p.side}">${p.side.toUpperCase()}</span></div><div class="pos-details"><span>${formatUSD(p.size)} @ ${(p.entry * 100).toFixed(0)}¢</span><span class="pos-pnl ${p.pnl >= 0 ? 'up' : 'down'}">${p.pnl >= 0 ? '+' : ''}${formatUSD(p.pnl)}</span></div><button class="pos-close" data-id="${p.id}">Close Position</button></div>`).join('')
  } else if (state.posTab === 'orders') {
    const pending = state.orders.filter(o => o.status === 'pending')
    posContent = pending.length === 0 ? '<div class="empty">No pending orders</div>' :
      pending.map(o => `<div class="pos-item"><div class="pos-header"><span class="pos-market">${o.market}</span><span class="pos-side ${o.side}">${o.side.toUpperCase()}</span></div><div class="pos-details"><span>${formatUSD(o.size)} @ ${(o.price * 100).toFixed(0)}¢</span><span>Pending</span></div></div>`).join('')
  } else {
    posContent = state.history.length === 0 ? '<div class="empty">No trade history</div>' :
      state.history.map(h => `<div class="pos-item"><div class="pos-header"><span class="pos-market">${h.market}</span><span class="pos-side ${h.side}">${h.side.toUpperCase()}</span></div><div class="pos-details"><span>${formatUSD(h.size)}</span><span class="pos-pnl ${h.pnl >= 0 ? 'up' : 'down'}">${h.pnl >= 0 ? '+' : ''}${formatUSD(h.pnl)}</span></div></div>`).join('')
  }

  return `
    <div class="avatar-area mode-${state.avatarMode}">
      <img id="avatar-img" class="avatar-img" src="nemesis-chan/${state.currentEmotion}.png" alt="Nemesis">
    </div>
    <div class="panels-container">
      <div class="panel ${state.panelStates.market ? '' : 'collapsed'}">
        <div class="panel-head" data-panel="market"><span class="panel-title">Market</span><span class="panel-toggle">${ICONS.chevron}</span></div>
        <div class="panel-body">
          <button class="market-btn" id="market-btn">
            <div class="market-asset">${m.asset}</div>
            <div class="market-question">${m.question}</div>
            <div class="market-prices"><span class="price-yes">${(m.yesPrice * 100).toFixed(0)}¢ YES</span><span class="price-no">${(m.noPrice * 100).toFixed(0)}¢ NO</span></div>
            <div class="market-meta">${formatTime(timeLeft)} remaining · Vol: ${formatCompact(m.volume)}</div>
          </button>
        </div>
      </div>
      <div class="panel ${state.panelStates.order ? '' : 'collapsed'}">
        <div class="panel-head" data-panel="order"><span class="panel-title">Place Order</span><span class="panel-toggle">${ICONS.chevron}</span></div>
        <div class="panel-body">
          <div class="order-tabs">
            <button class="order-tab yes ${state.orderTab === 'yes' ? 'active' : ''}" data-tab="yes">${ICONS.check} YES</button>
            <button class="order-tab no ${state.orderTab === 'no' ? 'active' : ''}" data-tab="no">${ICONS.cross} NO</button>
            <button class="order-tab lobby ${state.orderTab === 'lobby' ? 'active' : ''}" data-tab="lobby">${ICONS.lobby} Lobby</button>
            <button class="order-tab duel ${state.orderTab === 'duel' ? 'active' : ''}" data-tab="duel">${ICONS.swords} 1v1</button>
          </div>
          <div class="form-group">
            <label class="form-label">Stake Amount</label>
            <div class="form-input-wrap"><input type="number" class="form-input" id="stake-input" value="${state.stake}" min="1" step="10"><span class="form-suffix">USDC</span></div>
            <input type="range" class="stake-slider" id="stake-slider" min="10" max="1000" step="10" value="${state.stake}">
          </div>
          ${(isLobby || isDuel) ? `<div class="form-group"><label class="form-label">${isLobby ? 'Invite Friend (Address/ENS)' : 'Challenge Rival (Address/ENS)'}</label><div class="form-input-wrap"><input type="text" class="form-input" id="target-input" placeholder="0x... or name.eth" value="${state.targetAddress}"></div></div>` : ''}
          <div class="order-summary">
            <div class="summary-row"><span class="label">Price</span><span class="value">${(price * 100).toFixed(0)}¢</span></div>
            <div class="summary-row"><span class="label">Shares</span><span class="value">${payout.toFixed(2)}</span></div>
            <div class="summary-row"><span class="label">Potential Profit</span><span class="value profit">+${formatUSD(profit)}</span></div>
          </div>
          <button class="order-btn ${state.orderTab}" id="order-btn" ${state.processing ? 'disabled' : ''}>${state.processing ? 'Processing...' : getOrderButtonText()}</button>
        </div>
      </div>
      <div class="panel ${state.panelStates.positions ? '' : 'collapsed'}">
        <div class="panel-head" data-panel="positions"><span class="panel-title">Positions</span><span class="panel-toggle">${ICONS.chevron}</span></div>
        <div class="panel-body">
          <div class="pos-tabs">
            <button class="pos-tab ${state.posTab === 'positions' ? 'active' : ''}" data-tab="positions">Open <span class="cnt">${openCount}</span></button>
            <button class="pos-tab ${state.posTab === 'orders' ? 'active' : ''}" data-tab="orders">Orders <span class="cnt">${orderCount}</span></button>
            <button class="pos-tab ${state.posTab === 'history' ? 'active' : ''}" data-tab="history">History</button>
          </div>
          <div class="pos-list">${posContent}</div>
        </div>
      </div>
    </div>
  `
}

function getOrderButtonText(): string {
  switch (state.orderTab) {
    case 'yes': return 'BUY YES'
    case 'no': return 'BUY NO'
    case 'lobby': return 'CREATE LOBBY'
    case 'duel': return 'SEND CHALLENGE'
  }
}

function renderArchivePage(): string {
  return `<div class="full-page"><h1 class="page-title">:: Archive ::</h1><div class="empty">Archive collection coming soon.</div></div>`
}

function renderReturnsPage(): string {
  return `<div class="full-page"><h1 class="page-title">:: Returns & Shipping ::</h1><div class="empty">Returns and shipping policy coming soon.</div></div>`
}

function renderMarketModal(): string {
  const filters = ['all', 'crypto']
  const filtered = state.marketFilter === 'all' ? state.markets : state.markets.filter(m => m.category === state.marketFilter)
  return `<div class="modal" id="market-modal"><div class="modal-box"><div class="modal-head"><span class="modal-title">:: Select Market ::</span><button class="modal-close" id="modal-close">×</button></div><div class="modal-filters">${filters.map(f => `<button class="modal-filter ${state.marketFilter === f ? 'active' : ''}" data-filter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`).join('')}</div><div class="modal-list">${filtered.map(m => `<div class="modal-option ${m.id === state.selectedMarket ? 'selected' : ''}" data-id="${m.id}"><div class="modal-option-info"><span class="modal-option-asset">${m.asset}</span><span class="modal-option-q">${m.question}</span></div><div class="modal-option-prices"><span class="price-yes">${(m.yesPrice * 100).toFixed(0)}¢</span><span class="price-no">${(m.noPrice * 100).toFixed(0)}¢</span></div></div>`).join('')}</div></div></div>`
}

function renderConnectionIndicator(): string {
  const s = state.connectionState
  const stateClass = s === 'CONNECTED' ? 'state-connected' : s === 'DEGRADED' ? 'state-degraded' : 'state-disconnected'
  const label = s === 'CONNECTED' ? '' : s === 'DEGRADED' ? '' : connectionMonitor.getFormattedLastUpdate()

  return `
    <div class="connection-indicator ${stateClass}" id="connection-indicator">
      <div class="connection-dot"></div>
      ${label ? `<span class="connection-label">${label}</span>` : ''}
    </div>
  `
}

function renderDiagnosticPanel(): string {
  if (!state.showDiagnosticPanel) return ''

  const status = connectionMonitor.getStatus()
  const history = connectionMonitor.getHistory(10)

  const historyRows = history.slice().reverse().map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString()
    let desc = e.type
    if (e.type === 'state_change') desc = `${e.data.previous || 'Init'} → ${e.data.current}`
    else if (e.type === 'health_check') desc = `Health: ${e.data.status} (${e.data.latency}ms)`
    else if (e.type === 'error') desc = `Failed (${e.data.consecutiveFailures}x)`
    return `<div class="history-item"><span class="history-time">${time}</span><span class="history-event">${desc}</span></div>`
  }).join('')

  return `
    <div class="diagnostic-panel" id="diagnostic-panel">
      <div class="diagnostic-header">
        <span class="diagnostic-title">Connection</span>
        <button class="diagnostic-close" id="diagnostic-close">×</button>
      </div>
      <div class="diagnostic-overview">
        <div class="overall-state state-${state.connectionState.toLowerCase()}">${state.connectionState}</div>
        <div class="last-update">Last check: ${connectionMonitor.getFormattedLastUpdate()}</div>
      </div>
      <div class="diagnostic-section">
        <div class="diagnostic-section-title">Server</div>
        <div class="latency-row"><span>Latency:</span><span>${status.lastLatency > 0 ? `${status.lastLatency}ms` : '—'}</span></div>
        <div class="latency-row"><span>Average:</span><span>${status.avgLatency > 0 ? `${status.avgLatency}ms` : '—'}</span></div>
        <div class="latency-row"><span>Browser:</span><span>${status.online ? 'Online' : 'Offline'}</span></div>
      </div>
      <div class="diagnostic-section">
        <div class="diagnostic-section-title">Recent Events</div>
        <div class="history-list">${historyRows || '<div class="history-empty">No events yet</div>'}</div>
      </div>
    </div>
  `
}

function updateDialogueMask() {
  const box = document.querySelector('.dialogue-box') as HTMLElement
  const portrait = document.querySelector('.dialogue-portrait') as HTMLElement

  if (!box || !portrait) return

  if (!portrait.classList.contains('visible')) {
    box.style.clipPath = 'none'
    return
  }

  const boxRect = box.getBoundingClientRect()
  const portRect = portrait.getBoundingClientRect()

  const left = portRect.left - boxRect.left
  const top = portRect.top - boxRect.top
  const right = left + portRect.width
  const bottom = top + portRect.height

  const x1 = Math.max(0, left)
  const y1 = Math.max(0, top)
  const x2 = Math.min(boxRect.width, right)
  const y2 = Math.min(boxRect.height, bottom)

  if (x2 <= 0 || y2 <= 0 || x1 >= boxRect.width || y1 >= boxRect.height) {
    box.style.clipPath = 'none'
    return
  }

  box.style.clipPath = `polygon(
    0 0,
    0 ${y1}px,
    ${x2}px ${y1}px,
    ${x2}px ${y2}px,
    0 ${y2}px,
    0 100%,
    100% 100%,
    100% 0
  )`
}
