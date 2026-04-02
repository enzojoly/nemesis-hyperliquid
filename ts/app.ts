import { state, initData } from './state'
import { render } from './render'
import { setupDelegatedEvents } from './events'
import { showRandomDialogue } from './signal'
import { connectionMonitor } from './connection'
import type { ConnectionState } from './connection'

function initConnectionMonitor() {
  connectionMonitor.init()

  connectionMonitor.on('stateChange', (event: { previous: ConnectionState; current: ConnectionState }) => {
    state.connectionState = event.current
    state.lastConnectionDialogue = Date.now()

    if (state.scene !== 'main' || !state.introComplete) {
      render()
      return
    }

    switch (event.current) {
      case 'DEGRADED':
        if (event.previous === 'CONNECTED') {
          showRandomDialogue('connectionDegraded')
        }
        break
      case 'DISCONNECTED':
        showRandomDialogue('connectionLost')
        break
      case 'CONNECTED':
        if (event.previous !== 'CONNECTED') {
          showRandomDialogue('connectionRestored')
        }
        break
    }

    render()
  })

  connectionMonitor.on('healthCheck', () => {
    if (state.showDiagnosticPanel) {
      render()
    }
  })
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js')
    .then((reg) => console.log('[SW] Registered, scope:', reg.scope))
    .catch((err) => console.warn('[SW] Registration failed:', err))
}

function init() {
  initData()
  initServiceWorker()
  initConnectionMonitor()
  setupDelegatedEvents()
  render()
  console.log('NEMESIS initialized')
}

init()
