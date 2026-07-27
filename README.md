# SvelteKit Note-Taking App

## Overview

A client-side encrypted scratchpad. One note per user, encrypted and decrypted
entirely in the browser. The server stores an opaque envelope and never sees
plaintext or encryption keys. Identity and the account's single passkey come
from the SSO host, so the app has no user table or password form of its own.
Rows are keyed on the SSO account UUID. A console pane narrates non-secret
crypto steps and their real elapsed time.

## Features

- **Passkey-only encryption**: a user-verified WebAuthn PRF output feeds
  HKDF-SHA256, which derives the AES-256-GCM key that unwraps the random note
  key. PRF output and unwrapped keys never leave the tab.
- **Fresh verification**: every reload and Lock requires the passkey again.
  No key is cached in IndexedDB or handed through a URL.
- **Single sign-on**: authentication is delegated to `timben.net`; the app only
  resolves the shared session cookie and public passkey metadata.
- **No account setup**: your note is created on first unlock.
- **Tamper-evident and context-bound**: modified, swapped, or stale-context
  ciphertext fails AES-GCM authentication rather than returning garbage.

There is deliberately no password, recovery key, or server escrow. Losing or
replacing the account's passkey permanently loses access to the note.

## Getting Started

### Prerequisites

**Node.js 24 or newer.** The app uses the built-in `node:sqlite` module, so
there is no native database dependency to compile.

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/nebmit/note.git
   cd note
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment configuration**

   Copy `.env.example` to `.env` and adjust:

   - `ORIGIN` (required) — the origin this app is served from, e.g.
     `https://note.timben.net`. Used by adapter-node and to build the absolute
     `redirect_uri` handed to the SSO host. It is deliberately *not* derived
     from the request `Host` header, so it stays correct behind a proxy.
   - `AUTH_ORIGIN` (required) — the SSO host origin: `https://timben.net`, or
     `http://localhost:5172` in development. Paths are appended by the app.
   - `PORT` (optional, defaults to `3000`).
   - `DATABASE_PATH` (optional, defaults to `./database_sqlite3.db`).

   These are read at **runtime**, not baked in at build time, so one build can
   be re-pointed between environments without rebuilding.

### Running the Application

```bash
npm run build
npm start
```

Quality gates: `npm run check` (svelte-check) and `npm run lint` (ESLint).
Run `npm test` for crypto, WebAuthn, database, validation, and API tests.

## Encryption and storage

On first use the browser reserves random 32-byte PRF and HKDF inputs, evaluates
the authenticator PRF, derives a non-extractable key-encryption key, and wraps a
random AES-256-GCM data-encryption key. The server stores only those public
inputs, the credential ID, wrapped key, ciphertext, and a compare-and-swap
revision.

Wrapped keys and notes use versioned envelopes:

```json
{ "v": 1, "alg": "A256GCM", "iv": "<base64url>", "ct": "<base64url>" }
```

Every operation uses a fresh 12-byte IV and a 128-bit authentication tag.
Additional authenticated data binds key wraps and note ciphertext to their
protocol, account, credential, keyring, and revision contexts.
