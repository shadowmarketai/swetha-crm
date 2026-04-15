# Swetha Baileys Bridge

Tiny Node.js service that lets the Swetha CRM inbox talk to **WhatsApp Web** via
[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys). You pair
your phone once by scanning a QR, and the bridge relays messages to/from the
main Python backend.

> **Warning.** This uses the unofficial WhatsApp Web protocol. It **violates
> WhatsApp's Terms of Service** and your number can be banned at any time.
> For production use, prefer the **WhatsApp Business API** (WATI / Gupshup /
> Twilio) — the CRM supports both modes and you pick per connection.

## Prerequisites

- Node.js 18 or newer
- The Swetha backend running on `http://localhost:8000` (or set `WEBHOOK_URL`)

## Install & start

```bash
cd baileys-bridge
npm install
npm start
```

The bridge listens on `http://localhost:4001`.

## How the CRM uses it

1. In the CRM UI: **Inbox → WhatsApp → Connect → "WhatsApp Web (QR)"**.
2. The backend calls `GET /session/:id/qr` on the bridge and returns the QR
   to the browser.
3. You scan the QR from your phone's WhatsApp → Linked Devices.
4. Incoming messages arrive as `messages.upsert` events on the Baileys socket,
   which the bridge forwards as an HTTP POST to:

   ```
   POST ${WEBHOOK_URL}/api/v1/inbox/public/whatsapp/{connectionId}
   ```

   The CRM persists them and broadcasts a realtime event so the inbox updates
   instantly.

## Environment variables

| Var               | Default                  | Purpose                                                     |
| ----------------- | ------------------------ | ----------------------------------------------------------- |
| `PORT`            | `4001`                   | HTTP port the bridge listens on                             |
| `WEBHOOK_URL`     | `http://localhost:8000`  | Where to POST inbound messages                              |
| `CONNECTION_MAP`  | `{}`                     | JSON map: `{"<session_id>": <inbox_connection_id>}`         |

### Wiring `CONNECTION_MAP`

When you create a Baileys connection in the CRM, it's stored in the
`inbox_connections` table with an integer `id`. The bridge needs to know which
connection to attribute each incoming message to.

Start the bridge with:

```bash
CONNECTION_MAP='{"user-sw-admin":17}' npm start
```

where `17` is the id shown in the CRM's connection card and `user-sw-admin`
matches the `session_id` stored in the connection's config JSON
(defaults to `user-<user_id>` if you don't set one).

## Auth storage

Baileys persists pairing credentials in `./auth/<session_id>/`. Delete that
directory to force a fresh QR scan.

## Endpoints (debug)

- `GET  /status`                    — list all sessions
- `GET  /session/:id/qr`            — get QR image (as data URL) or connected status
- `POST /session/:id/send`          — body `{to, text}` → send a message
- `POST /session/:id/logout`        — close the session

## Production notes

- The bridge is a single process with no persistence beyond the local
  `auth/` folder. For multi-user deployments run it behind a process
  manager (pm2, systemd) and back up the auth folder.
- Don't expose the bridge port publicly. Keep it on localhost or a private
  network shared with the backend.
- Baileys regularly breaks when WhatsApp updates the web protocol. Keep it
  pinned to a known-working version and test after each upgrade.
