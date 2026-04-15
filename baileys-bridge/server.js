/**
 * Swetha Baileys Bridge
 * =====================
 * Minimal Node.js service that wraps @whiskeysockets/baileys and exposes a
 * small HTTP API so the Python backend can talk to WhatsApp Web without
 * embedding a Node runtime.
 *
 * Endpoints:
 *   GET  /status                          → { connected, sessions: [...] }
 *   GET  /session/:id/qr                  → { qr: "data:image/png;base64,...", connected, phone }
 *   POST /session/:id/send                → { to, text } → dispatches a message
 *   POST /session/:id/logout              → closes a session
 *
 * Incoming messages are forwarded to the main backend as webhook POSTs to:
 *   ${WEBHOOK_URL}/api/v1/inbox/public/whatsapp/{connectionId}
 *
 * Environment:
 *   PORT            (default 4001)
 *   WEBHOOK_URL     (default http://localhost:8000)
 *   CONNECTION_MAP  (optional JSON: {"sessionId": connectionId, ...})
 *
 * IMPORTANT: Baileys uses WhatsApp Web. It is UNOFFICIAL and violates
 * WhatsApp's Terms of Service. Your number can be banned at any time.
 * Use at your own risk. For production, use the BSP option in the CRM
 * instead (WATI / Gupshup / Twilio).
 */

const express = require('express')
const QRCode = require('qrcode')
const P = require('pino')
let baileys

try {
  baileys = require('@whiskeysockets/baileys')
} catch (e) {
  console.error('[baileys-bridge] Dependency missing. Run `npm install` first.')
  process.exit(1)
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

const PORT = parseInt(process.env.PORT || '4001', 10)
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8000'
const CONNECTION_MAP = (() => {
  try { return JSON.parse(process.env.CONNECTION_MAP || '{}') } catch { return {} }
})()

const logger = P({ level: 'warn' })
const app = express()
app.use(express.json({ limit: '5mb' }))

// sessionId → { sock, qrDataUrl, connected, phone }
const sessions = new Map()

async function startSession(sessionId) {
  if (sessions.has(sessionId) && sessions.get(sessionId).connected) {
    return sessions.get(sessionId)
  }

  const { state, saveCreds } = await useMultiFileAuthState(`./auth/${sessionId}`)
  const sock = makeWASocket({ auth: state, printQRInTerminal: false, logger })
  const entry = { sock, qrDataUrl: null, connected: false, phone: null }
  sessions.set(sessionId, entry)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      try { entry.qrDataUrl = await QRCode.toDataURL(qr) } catch {}
    }
    if (connection === 'open') {
      entry.connected = true
      entry.qrDataUrl = null
      entry.phone = (sock.user && sock.user.id) ? String(sock.user.id).split(':')[0] : null
      console.log(`[baileys-bridge] session ${sessionId} connected as ${entry.phone}`)
    } else if (connection === 'close') {
      entry.connected = false
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        console.log(`[baileys-bridge] session ${sessionId} closed, reconnecting…`)
        setTimeout(() => startSession(sessionId).catch(() => {}), 2000)
      } else {
        console.log(`[baileys-bridge] session ${sessionId} logged out`)
        sessions.delete(sessionId)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue
      const text = (
        m.message.conversation ||
        (m.message.extendedTextMessage && m.message.extendedTextMessage.text) ||
        ''
      )
      const from = (m.key.remoteJid || '').split('@')[0]
      const name = m.pushName || null
      const connectionId = CONNECTION_MAP[sessionId]
      if (!connectionId) {
        console.log(`[baileys-bridge] no CONNECTION_MAP entry for ${sessionId}; dropping`)
        continue
      }
      try {
        await fetch(`${WEBHOOK_URL}/api/v1/inbox/public/whatsapp/${connectionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, name, text, id: m.key.id }),
        })
      } catch (err) {
        console.error('[baileys-bridge] webhook POST failed', err.message)
      }
    }
  })

  return entry
}

app.get('/status', (_req, res) => {
  const list = []
  for (const [id, e] of sessions.entries()) {
    list.push({ id, connected: e.connected, phone: e.phone })
  }
  res.json({ connected: list.some((s) => s.connected), sessions: list })
})

app.get('/session/:id/qr', async (req, res) => {
  try {
    const entry = await startSession(req.params.id)
    res.json({ qr: entry.qrDataUrl, connected: entry.connected, phone: entry.phone })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/session/:id/send', async (req, res) => {
  const entry = sessions.get(req.params.id)
  if (!entry || !entry.connected) return res.status(409).json({ error: 'Session not connected' })
  const { to, text } = req.body || {}
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' })
  const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`
  try {
    const sent = await entry.sock.sendMessage(jid, { text })
    res.json({ id: sent.key.id, to: jid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/session/:id/logout', async (req, res) => {
  const entry = sessions.get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Session not found' })
  try {
    await entry.sock.logout()
    sessions.delete(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`[baileys-bridge] listening on http://localhost:${PORT}`)
  console.log(`[baileys-bridge] WEBHOOK_URL=${WEBHOOK_URL}`)
  console.log(`[baileys-bridge] CONNECTION_MAP=${JSON.stringify(CONNECTION_MAP)}`)
})
