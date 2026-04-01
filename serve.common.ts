import swTemplate from "./sw.template.js" with { type: "text" }

import fontQuicksand from "./fonts/Quicksand/Quicksand-VariableFont_wght.woff2" with { type: "file" }
import fontCinzel from "./fonts/Cinzel/Cinzel-VariableFont_wght.woff2" with { type: "file" }

import nemesisConcerned from "./nemesis-chan/concerned.png" with { type: "file" }
import nemesisExcited from "./nemesis-chan/excited.png" with { type: "file" }
import nemesisHappy from "./nemesis-chan/happy.png" with { type: "file" }
import nemesisInquisitive from "./nemesis-chan/inquisitive.png" with { type: "file" }
import nemesisKawaii from "./nemesis-chan/kawaii.png" with { type: "file" }
import nemesisLoss from "./nemesis-chan/loss.png" with { type: "file" }
import nemesisPleased from "./nemesis-chan/pleased.png" with { type: "file" }
import nemesisSly from "./nemesis-chan/sly.png" with { type: "file" }
import nemesisTalkative from "./nemesis-chan/talkative.png" with { type: "file" }

import iconPng from "./icon.png" with { type: "file" }

import cssBase from "./css/base.css" with { type: "file" }
import cssBackgrounds from "./css/backgrounds.css" with { type: "file" }
import cssTitle from "./css/title.css" with { type: "file" }
import cssCrt from "./css/crt.css" with { type: "file" }
import cssDialogue from "./css/dialogue.css" with { type: "file" }
import cssHeader from "./css/header.css" with { type: "file" }
import cssAvatar from "./css/avatar.css" with { type: "file" }
import cssPanels from "./css/panels.css" with { type: "file" }
import cssPages from "./css/pages.css" with { type: "file" }
import cssConnection from "./css/connection.css" with { type: "file" }
import cssUtils from "./css/utils.css" with { type: "file" }
import cssResponsive from "./css/responsive.css" with { type: "file" }

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const port = parseInt(process.env.PORT || "3000", 10)

export const CACHE_MODES = ["fresh", "persistent", "disabled"] as const
export type CacheMode = typeof CACHE_MODES[number]

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain",
}

export function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf("."))
  return MIME[ext] || "application/octet-stream"
}

// ---------------------------------------------------------------------------
// Static assets — embedded at compile time for prod binary
// ---------------------------------------------------------------------------

export const staticAssets = new Map<string, { filePath: string; contentType: string }>([
  ["/icon.png", { filePath: iconPng, contentType: "image/png" }],
  ["/favicon.ico", { filePath: iconPng, contentType: "image/x-icon" }],
  ["/fonts/Quicksand/Quicksand-VariableFont_wght.woff2", { filePath: fontQuicksand, contentType: "font/woff2" }],
  ["/fonts/Cinzel/Cinzel-VariableFont_wght.woff2", { filePath: fontCinzel, contentType: "font/woff2" }],
  ["/nemesis-chan/concerned.png", { filePath: nemesisConcerned, contentType: "image/png" }],
  ["/nemesis-chan/excited.png", { filePath: nemesisExcited, contentType: "image/png" }],
  ["/nemesis-chan/happy.png", { filePath: nemesisHappy, contentType: "image/png" }],
  ["/nemesis-chan/inquisitive.png", { filePath: nemesisInquisitive, contentType: "image/png" }],
  ["/nemesis-chan/kawaii.png", { filePath: nemesisKawaii, contentType: "image/png" }],
  ["/nemesis-chan/loss.png", { filePath: nemesisLoss, contentType: "image/png" }],
  ["/nemesis-chan/pleased.png", { filePath: nemesisPleased, contentType: "image/png" }],
  ["/nemesis-chan/sly.png", { filePath: nemesisSly, contentType: "image/png" }],
  ["/nemesis-chan/talkative.png", { filePath: nemesisTalkative, contentType: "image/png" }],
  ["/css/base.css", { filePath: cssBase, contentType: "text/css" }],
  ["/css/backgrounds.css", { filePath: cssBackgrounds, contentType: "text/css" }],
  ["/css/title.css", { filePath: cssTitle, contentType: "text/css" }],
  ["/css/crt.css", { filePath: cssCrt, contentType: "text/css" }],
  ["/css/dialogue.css", { filePath: cssDialogue, contentType: "text/css" }],
  ["/css/header.css", { filePath: cssHeader, contentType: "text/css" }],
  ["/css/avatar.css", { filePath: cssAvatar, contentType: "text/css" }],
  ["/css/panels.css", { filePath: cssPanels, contentType: "text/css" }],
  ["/css/pages.css", { filePath: cssPages, contentType: "text/css" }],
  ["/css/connection.css", { filePath: cssConnection, contentType: "text/css" }],
  ["/css/utils.css", { filePath: cssUtils, contentType: "text/css" }],
  ["/css/responsive.css", { filePath: cssResponsive, contentType: "text/css" }],
])

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

const startTime = Date.now()

export function serveHealth(mode: string): Response {
  const mem = process.memoryUsage()
  const heapUsed = Math.round(mem.heapUsed / 1024 / 1024)
  const heapTotal = Math.round(mem.heapTotal / 1024 / 1024)
  const uptime = Date.now() - startTime

  return Response.json({
    status: "ok",
    mode,
    timestamp: Date.now(),
    uptime,
    uptimeHuman: formatUptime(uptime),
    memory: {
      heapUsed,
      heapTotal,
      percent: Math.round((heapUsed / heapTotal) * 100),
    },
    version: process.env.BUILD_VERSION || "dev",
  })
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

export function serveServiceWorker(cacheMode: CacheMode, version: string): Response {
  if (cacheMode === "disabled") {
    const noop = `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => {
  self.clients.matchAll().then(clients => clients.forEach(c => c.postMessage(JSON.stringify({ type: 'connection', healthy: true }))))
  self.registration.unregister()
})`
    return new Response(noop, {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" },
    })
  }

  const sw = swTemplate.replace(/__CACHE_VERSION__/g, version)
  return new Response(sw, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" },
  })
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

export async function serveStaticFile(pathname: string, noCache = false): Promise<Response | null> {
  let filePath = pathname === "/" ? "/index.html" : pathname

  const file = Bun.file(`.${filePath}`)
  if (!(await file.exists())) return null

  return new Response(file, {
    headers: {
      "Content-Type": getContentType(filePath),
      "Cache-Control": noCache
        ? "no-store"
        : filePath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable",
    },
  })
}

// ---------------------------------------------------------------------------
// SPA fallback
// ---------------------------------------------------------------------------

export async function serveFallback(): Promise<Response> {
  const file = Bun.file("./index.html")
  return new Response(file, {
    headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" },
  })
}
