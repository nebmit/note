# SvelteKit Note-Taking App

## Overview

A client-side encrypted scratchpad. One note per user, encrypted and decrypted
entirely in the browser. The server stores an opaque envelope and never sees
plaintext or the password. Identity comes from an SSO host, so the
app has no user table and no login form of its own; rows are keyed on the SSO
account uuid. A console pane narrates each crypto step as it happens.

## Features

- **Client-side encryption/decryption**: AES-GCM with a key derived from your
  password via PBKDF2-SHA256 (600,000 iterations). The key never leaves the tab.
- **Single sign-on**: authentication is delegated to `timben.net`; the app only
  resolves the shared session cookie.
- **No account setup**: your note is created on first unlock.
- **Tamper-evident**: a wrong password, or modified ciphertext, fails the
  AES-GCM authentication tag rather than returning garbage.

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

## Storage format

Notes are stored as a self-describing JSON envelope:

```json
{ "v": 1, "kdf": "PBKDF2-SHA256", "iter": 600000,
  "salt": "<base64>", "iv": "<base64>", "ct": "<base64>" }
```

A **fresh 12-byte IV is generated on every save** — reusing an AES-GCM nonce
under a fixed key leaks plaintext and weakens the authentication tag.

Because the KDF and its parameters travel inside each record, raising the
iteration count or switching KDF later is a `v` bump that existing readers still
handle, rather than another breaking re-encryption.
