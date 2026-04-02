import { watch, watchFile } from "fs"
import { port, getContentType, serveHealth, serveServiceWorker, serveStaticFile, staticAssets, type CacheMode } from "./serve.common"

const DEBUG = process.env.DEBUG === "1"

const CACHE_MODE = (process.env.CACHE_MODE || "fresh") as CacheMode
const BUILD_VERSION = CACHE_MODE === "fresh"
  ? `dev-${Date.now()}`
  : "dev-persistent"

// ---------------------------------------------------------------------------
// HMR — Server-Sent Events for CSS hot reload
// ---------------------------------------------------------------------------

interface HmrClient {
  controller: ReadableStreamDefaultController
  closed: boolean
}

const hmrClients = new Set<HmrClient>()

function broadcast(data: Record<string, unknown>): void {
  const message = `data: ${JSON.stringify(data)}\n\n`
  const encoded = new TextEncoder().encode(message)

  for (const client of hmrClients) {
    if (client.closed) { hmrClients.delete(client); continue }
    try {
      client.controller.enqueue(encoded)
    } catch {
      client.closed = true
      hmrClients.delete(client)
    }
  }
}

// ---------------------------------------------------------------------------
// CSS file watching — poll-based for reliability
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 50
const POLL_INTERVAL = 100
const debounceTimers = new Map<string, Timer>()
const watchedFiles = new Set<string>()

function watchCssFile(filename: string): void {
  if (watchedFiles.has(filename)) return
  watchedFiles.add(filename)

  watchFile(filename, { interval: POLL_INTERVAL }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      const existing = debounceTimers.get(filename)
      if (existing) clearTimeout(existing)

      debounceTimers.set(filename, setTimeout(() => {
        debounceTimers.delete(filename)
        console.log(`[HMR] CSS updated: ${filename}`)
        broadcast({ type: "css", file: filename })
      }, DEBOUNCE_MS))
    }
  })
}

watchCssFile("style.css")

watch(".", { recursive: true }, (_event, filename) => {
  if (!filename) return
  if (filename.includes("node_modules") || filename.includes("dist")) return

  if (filename.endsWith(".css")) {
    watchCssFile(filename)

    const existing = debounceTimers.get(filename)
    if (existing) clearTimeout(existing)
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename)
      console.log(`[HMR] CSS updated: ${filename}`)
      broadcast({ type: "css", file: filename })
    }, DEBOUNCE_MS))
  }
})

// ---------------------------------------------------------------------------
// On-the-fly TypeScript bundling
// ---------------------------------------------------------------------------

let cachedBundle: string | null = null

async function bundleApp(): Promise<string> {
  const result = await Bun.build({
    entrypoints: ["./index.ts"],
    sourcemap: "inline",
    target: "browser",
  })

  if (!result.success) {
    const errors = result.logs.map((l) => String(l)).join("\n")
    console.error("[BUILD]", errors)
    return `document.title="BUILD ERROR";console.error(${JSON.stringify(errors)})`
  }

  cachedBundle = await result.outputs[0].text()
  return cachedBundle
}

// Invalidate bundle when TS files change
try {
  watch("./ts", { recursive: true }, (_event, filename) => {
    if (filename && filename.endsWith(".ts")) {
      cachedBundle = null
      if (DEBUG) console.log(`[BUILD] Invalidated: ts/${filename}`)
    }
  })
} catch { /* ts dir may not exist yet */ }

watch(".", { recursive: false }, (_event, filename) => {
  if (filename === "index.ts") {
    cachedBundle = null
    if (DEBUG) console.log("[BUILD] Invalidated: index.ts")
  }
})

// ---------------------------------------------------------------------------
// HMR client script — injected into HTML responses
// ---------------------------------------------------------------------------

const HMR_SCRIPT = `
<script>
(function() {
  function connectHMR() {
    var es = new EventSource('/__hmr')
    es.onmessage = function(e) {
      var data = JSON.parse(e.data)
      if (data.type === 'css') {
        var links = document.querySelectorAll('link[rel="stylesheet"]')
        links.forEach(function(link) {
          var href = link.getAttribute('href').split('?')[0]
          link.setAttribute('href', href + '?t=' + Date.now())
        })
      }
    }
    es.onerror = function() {
      es.close()
      setTimeout(connectHMR, 2000)
    }
  }
  connectHMR()
})()
</script>
`

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

console.log(`\nNEMESIS [DEV]${DEBUG ? " - DEBUG" : ""}\nhttp://localhost:${port}\n`)

Bun.serve({
  port,
  idleTimeout: 0,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    if (DEBUG && path !== "/health") console.log(`${req.method} ${path}`)

    // HMR SSE endpoint
    if (path === "/__hmr") {
      const stream = new ReadableStream({
        start(controller) {
          const client: HmrClient = { controller, closed: false }
          hmrClients.add(client)
          req.signal.addEventListener("abort", () => {
            client.closed = true
            hmrClients.delete(client)
          })
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "Connection": "keep-alive",
        },
      })
    }

    // Health
    if (path === "/health") return serveHealth("development")

    // Service worker
    if (path === "/sw.js") return serveServiceWorker(CACHE_MODE, BUILD_VERSION)

    // Bundle on the fly
    if (path === "/app.js") {
      const js = cachedBundle ?? await bundleApp()
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      })
    }

    // Embedded static assets (images, fonts, CSS for prod — serve from disk in dev)
    const staticAsset = staticAssets.get(path)
    if (staticAsset) {
      return new Response(Bun.file(staticAsset.filePath), {
        headers: { "Content-Type": staticAsset.contentType },
      })
    }

    // index.html — inject HMR script
    if (path === "/" || path === "/index.html") {
      const file = Bun.file("./index.html")
      let html = await file.text()
      html = html.replace("</body>", `${HMR_SCRIPT}</body>`)
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      })
    }

    // Static files (no-store in dev — soft refresh always fresh)
    const staticResponse = await serveStaticFile(path)
    if (staticResponse) return staticResponse

    // SPA fallback
    return new Response("404 Not Found", { status: 404 })
  },
})
