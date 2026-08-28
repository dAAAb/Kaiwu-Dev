// GET /api/health — liveness check. Deliberately touches no bindings (no D1).
import { API_VERSION } from '../openapi.json'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

export const onRequestGet: PagesFunction = async () =>
  Response.json({ ok: true, service: 'kaiwu', version: API_VERSION, time: new Date().toISOString() }, { headers })

// HEAD mirrors GET (same status and headers; body dropped).
export const onRequestHead: PagesFunction = async (context) => new Response(null, await onRequestGet(context))

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers })
