import { NextRequest } from 'next/server'

// Server builds only (dev and Vercel): the static export leaves `.ts` out of
// pageExtensions, so it skips this file — see next.config.mjs. The static S3 build fetches documents
// directly instead. Same idea as the /api rewrite — the S3 bucket
// behind our presigned document URLs has no CORS policy, so the browser can't
// fetch() them for the in-page preview (lib/documentViewer.ts). This fetches
// server-side instead and streams the bytes back same-origin, with
// Content-Disposition: inline so the preview renders rather than downloads.
// Remove once the bucket allows GET from the frontend origin.
//
// Only S3 hosts are allowed so this can't be used as an open proxy.

function isAllowedHost(url: URL) {
  return url.protocol === 'https:' && /(^|\.)s3[.-]([a-z0-9-]+\.)?amazonaws\.com$/.test(url.hostname)
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  let target: URL
  try {
    target = new URL(raw ?? '')
  } catch {
    return new Response('Invalid url', { status: 400 })
  }
  if (!isAllowedHost(target)) return new Response('Host not allowed', { status: 403 })

  const upstream = await fetch(target, { cache: 'no-store' })
  if (!upstream.ok || !upstream.body) return new Response('Failed to load document', { status: upstream.status || 502 })

  const headers = new Headers({ 'Content-Disposition': 'inline', 'Cache-Control': 'no-store' })
  const type = upstream.headers.get('content-type')
  if (type) headers.set('Content-Type', type)
  const length = upstream.headers.get('content-length')
  if (length) headers.set('Content-Length', length)
  return new Response(upstream.body, { status: 200, headers })
}
