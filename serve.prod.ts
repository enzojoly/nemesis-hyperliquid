import { port, serveHealth, serveServiceWorker, staticAssets } from "./serve.common"

import indexHtml from "./index.html" with { type: "file" }
import styleCss from "./style.css" with { type: "file" }
import appJs from "./dist/app.js" with { type: "file" }

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CACHE_VERSION = process.env.CACHE_VERSION || `prod-${Date.now()}`

// ---------------------------------------------------------------------------
// Prod assets — core files + shared static assets
// ---------------------------------------------------------------------------

const prodAssets = new Map<string, { filePath: string; contentType: string }>([
  ["/", { filePath: indexHtml, contentType: "text/html" }],
  ["/index.html", { filePath: indexHtml, contentType: "text/html" }],
  ["/style.css", { filePath: styleCss, contentType: "text/css" }],
  ["/app.js", { filePath: appJs, contentType: "text/javascript" }],
  ...staticAssets,
])

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

console.log(`\nNEMESIS [${CACHE_VERSION}]\nhttp://localhost:${port}\n`)

Bun.serve({
  port,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === "/health") return serveHealth("production")
    if (path === "/sw.js") return serveServiceWorker("persistent", CACHE_VERSION)

    const asset = prodAssets.get(path)
    if (asset) {
      return new Response(Bun.file(asset.filePath), {
        headers: {
          "Content-Type": asset.contentType,
          "Cache-Control": path.endsWith(".html") || path === "/"
            ? "no-cache"
            : "public, max-age=31536000, immutable",
        },
      })
    }

    return new Response("404 Not Found", { status: 404 })
  },
})
