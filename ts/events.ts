import { state } from './state'
import { render } from './render'
import { playSound } from './audio'
import { toast, getMarket, formatUSD } from './utils'
import { 
  connectSignal, 
  disconnectSignal, 
  setEmotion, 
  skipTypewriter, 
  showDialogue, 
  showRandomDialogue, 
  clearDismissTimer 
} from './signal'
import { INTRO_DIALOGUE } from './dialogue'
import type { NavTab, OrderTab, PosTab, AvatarMode } from './types'

let swRegistered = false

function registerServiceWorker(): void {
  if (swRegistered || !('serviceWorker' in navigator)) return
  swRegistered = true

  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('[SW] Registered, scope:', registration.scope)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              console.log('[SW] All nemesis-chan images eagerly cached')
            }
          })
        }
      })
    })
    .catch((err) => console.warn('[SW] Registration failed:', err))
}

function advanceIntro() {
  if (state.isTyping) { skipTypewriter(); return }
  state.introIndex++
  if (state.introIndex >= INTRO_DIALOGUE.length) {
    state.introComplete = true
    state.scene = 'main'
    playSound([523, 659, 784])
    render()
    setTimeout(() => showRandomDialogue('idle'), 500)
  } else {
    showDialogue(INTRO_DIALOGUE[state.introIndex])
  }
}

function handleTitleClick() {
  if (state.scene !== 'title') return

  if (!state.introStarted) {
    state.introStarted = true
    playSound([500])
    registerServiceWorker()
    connectSignal(() => {
      showDialogue(INTRO_DIALOGUE[0])
    })
  } else {
    advanceIntro()
    playSound([500])
  }
}

function handleDialogueClick() {
  if (state.scene !== 'main') return
  clearDismissTimer()

  if (state.avatarMode === 'off') {
    if (state.isTyping) {
      skipTypewriter()
    } else if (state.dialogueAtEnd && state.dialogueSignal === 'connected') {
      disconnectSignal()
    }
    playSound([500])
    return
  }

  if (state.isTyping) {
    skipTypewriter()
  } else {
    showRandomDialogue('idle')
  }
  playSound([500])
}

function handlePortraitClick() {
  if (state.avatarMode === 'full') return
  clearDismissTimer()

  if (state.dialogueSignal === 'off') {
    showRandomDialogue('idle')
    playSound([500])
    return
  }

  if (state.isTyping) {
    skipTypewriter()
    playSound([500])
    return
  }

  if (state.avatarMode === 'off') {
    if (state.dialogueAtEnd && state.dialogueSignal === 'connected') {
      disconnectSignal()
    }
  } else {
    showRandomDialogue('idle')
  }
  playSound([500])
}

async function handlePlaceOrder() {
  if (!state.connected) { toast('Connect wallet first!', 'error'); return }
  if (state.processing) return

  state.processing = true
  setEmotion('inquisitive')
  render()
  setTimeout(() => showDialogue({ text: "Processing your order...", emotion: 'inquisitive', showName: true }), 0)

  await new Promise(r => setTimeout(r, 1200))

  const m = getMarket()
  const side = state.orderTab === 'no' ? 'no' : 'yes'
  const price = side === 'yes' ? m.yesPrice : m.noPrice
  state.positions.push({
    id: `p${Date.now()}`,
    marketId: m.id,
    market: m.question,
    side: side as 'yes' | 'no',
    size: state.stake,
    entry: price,
    current: price,
    pnl: 0,
    type: state.orderTab === 'lobby' ? 'lobby' : state.orderTab === 'duel' ? 'duel' : 'standard',
    status: 'open'
  })

  state.processing = false
  playSound([523, 659, 784, 1047])
  toast('Order filled!', 'success')
  render()
  setTimeout(() => showRandomDialogue('filled'), 0)
}

function handleClosePosition(id: string) {
  const pos = state.positions.find(p => p.id === id)
  if (!pos) return

  pos.status = 'closed'
  state.history.unshift({ ...pos })
  state.positions = state.positions.filter(p => p.id !== id)

  playSound([400, 300])
  toast('Position closed!', 'success')
  render()
  setTimeout(() => showRandomDialogue('closed'), 0)
}

export function setupDelegatedEvents() {
  const app = document.getElementById('app')
  if (!app) return

  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    if (state.scene === 'title' && target.closest('#title-scene')) {
      handleTitleClick()
      return
    }

    const navBtn = target.closest('.nav-btn') as HTMLElement | null
    if (navBtn) {
      const nav = navBtn.dataset.nav as NavTab
      if (state.nav !== nav) {
        state.nav = nav
        playSound([600])
        render()
      }
      return
    }

    const modeBtn = target.closest('.mode-btn') as HTMLElement | null
    if (modeBtn) {
      const mode = modeBtn.dataset.mode as AvatarMode
      if (state.avatarMode !== mode) {
        const prevMode = state.avatarMode
        state.avatarMode = mode
        playSound([500])

        if (mode === 'off' && prevMode !== 'off') {
          disconnectSignal()
        }
        else if (mode !== 'off' && prevMode === 'off') {
          connectSignal(() => {
            showRandomDialogue('idle')
          })
        }

        render()
      }
      return
    }

    if (target.closest('#wallet-btn')) {
      if (!state.connected) {
        state.connected = true
        state.address = '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12'
        playSound([523, 659, 784])
        toast('Wallet connected!', 'success')
        render()
        setTimeout(() => showRandomDialogue('connect'), 0)
      }
      return
    }

    if (target.closest('#dialogue-portrait')) {
      handlePortraitClick()
      return
    }

    if (target.closest('#connection-indicator')) {
      state.showDiagnosticPanel = !state.showDiagnosticPanel
      playSound([500])
      render()
      return
    }

    if (target.closest('#diagnostic-close')) {
      state.showDiagnosticPanel = false
      render()
      return
    }

    if (state.scene === 'main') {
      if (target.closest('#dialogue-box')) {
        handleDialogueClick()
        return
      }
      if (target.closest('.avatar-area') && state.avatarMode === 'full') {
        handleDialogueClick()
        return
      }
    }

    const panelHead = target.closest('.panel-head') as HTMLElement | null
    if (panelHead) {
      const panel = panelHead.dataset.panel as keyof typeof state.panelStates
      if (panel && state.panelStates[panel] !== undefined) {
        state.panelStates[panel] = !state.panelStates[panel]
        render()
      }
      return
    }

    if (target.closest('#market-btn')) {
      state.showMarketModal = true
      playSound([500])
      render()
      return
    }

    const orderTab = target.closest('.order-tab') as HTMLElement | null
    if (orderTab) {
      const tab = orderTab.dataset.tab as OrderTab
      if (state.orderTab !== tab) {
        state.orderTab = tab
        playSound([600])
        render()
        if (tab === 'lobby') setTimeout(() => showRandomDialogue('lobby'), 0)
        else if (tab === 'duel') setTimeout(() => showRandomDialogue('duel'), 0)
      }
      return
    }

    if (target.closest('#order-btn')) {
      handlePlaceOrder()
      return
    }

    const posTab = target.closest('.pos-tab') as HTMLElement | null
    if (posTab) {
      const tab = posTab.dataset.tab as PosTab
      if (state.posTab !== tab) {
        state.posTab = tab
        playSound([500])
        render()
      }
      return
    }

    const posClose = target.closest('.pos-close') as HTMLElement | null
    if (posClose) {
      e.stopPropagation()
      const id = posClose.dataset.id
      if (id) handleClosePosition(id)
      return
    }

    if (target.id === 'market-modal') {
      state.showMarketModal = false
      render()
      return
    }

    if (target.closest('#modal-close')) {
      state.showMarketModal = false
      render()
      return
    }

    const modalFilter = target.closest('.modal-filter') as HTMLElement | null
    if (modalFilter) {
      state.marketFilter = modalFilter.dataset.filter || 'all'
      render()
      return
    }

    const modalOption = target.closest('.modal-option') as HTMLElement | null
    if (modalOption) {
      state.selectedMarket = modalOption.dataset.id || state.markets[0].id
      state.showMarketModal = false
      playSound([500])
      render()
      return
    }
  })

  app.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement

    if (target.id === 'stake-input') {
      state.stake = parseFloat(target.value) || 10
      const slider = document.getElementById('stake-slider') as HTMLInputElement
      if (slider && slider !== document.activeElement) {
        slider.value = String(state.stake)
      }
      render()
      return
    }

    if (target.id === 'stake-slider') {
      state.stake = parseFloat(target.value) || 10
      const input = document.getElementById('stake-input') as HTMLInputElement
      if (input && input !== document.activeElement) {
        input.value = String(state.stake)
      }
      render()
      return
    }

    if (target.id === 'target-input') {
      state.targetAddress = target.value
      return
    }
  })
}
