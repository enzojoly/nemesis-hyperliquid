var CACHE_NAME = 'nemesis-__CACHE_VERSION__'

var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/css/base.css',
  '/css/backgrounds.css',
  '/css/title.css',
  '/css/crt.css',
  '/css/dialogue.css',
  '/css/header.css',
  '/css/avatar.css',
  '/css/panels.css',
  '/css/pages.css',
  '/css/connection.css',
  '/css/utils.css',
  '/css/responsive.css',
  '/icon.png',
  '/fonts/Quicksand/Quicksand-VariableFont_wght.woff2',
  '/fonts/Cinzel/Cinzel-VariableFont_wght.woff2',
  '/nemesis-chan/concerned.png',
  '/nemesis-chan/excited.png',
  '/nemesis-chan/happy.png',
  '/nemesis-chan/inquisitive.png',
  '/nemesis-chan/kawaii.png',
  '/nemesis-chan/loss.png',
  '/nemesis-chan/pleased.png',
  '/nemesis-chan/sly.png',
  '/nemesis-chan/talkative.png',
]

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(STATIC_ASSETS) })
      .then(function() { return self.skipWaiting() })
  )
})

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(names) {
        return Promise.all(
          names.filter(function(n) { return n !== CACHE_NAME }).map(function(n) { return caches.delete(n) })
        )
      })
      .then(function() { return self.clients.claim() })
  )
})

self.addEventListener('fetch', function(event) {
  var request = event.request
  var url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/v1/')) return
  if (url.pathname === '/health') return
  if (url.hostname !== location.hostname) return

  event.respondWith(
    caches.match(request).then(function(cached) {
      if (cached) return cached
      return fetch(request).then(function(response) {
        if (response.ok && response.type === 'basic') {
          var clone = response.clone()
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone) })
        }
        return response
      }).catch(function() {
        return new Response('Offline', { status: 503 })
      })
    })
  )
})

// ---------------------------------------------------------------------------
// Health monitoring — 50ms polling
// ---------------------------------------------------------------------------

var healthState = { healthy: true, failures: 0 }

function scheduleHealthCheck() {
  setTimeout(function() {
    checkHealth().then(scheduleHealthCheck)
  }, 50)
}

async function checkHealth() {
  try {
    var res = await fetch('/health', { cache: 'no-store' })
    if (res.ok) {
      var wasUnhealthy = !healthState.healthy
      healthState = { healthy: true, failures: 0 }
      if (wasUnhealthy) broadcast({ type: 'connection', healthy: true })
    } else {
      onHealthFailure()
    }
  } catch (e) {
    onHealthFailure()
  }
}

function onHealthFailure() {
  healthState.failures++
  if (healthState.failures >= 2 && healthState.healthy) {
    healthState.healthy = false
    broadcast({ type: 'connection', healthy: false })
  }
}

async function broadcast(data) {
  var clients = await self.clients.matchAll({ type: 'window' })
  var message = JSON.stringify(data)
  clients.forEach(function(client) { client.postMessage(message) })
}

scheduleHealthCheck()
