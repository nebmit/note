# SvelteKit Note-Taking App

This is a client-side encrypted note-taking application built with SvelteKit and styled using Tailwind CSS. Notes are stored in an SQLite3 database and are encrypted/decrypted on the client side.

## Key Points
- Client-side encryption and decryption.
- Notes are identified by the account provided during sign-in.
- No account creation necessary. Notes are generated on-the-fly.
- If the correct password is provided or the note is empty, you can edit it. Incorrect passwords for non-empty notes prevent decryption and editing.

## Setup

### Prerequisites
- Node.js (latest LTS version recommended)

### Setup Instructions

#### Clone the repo:
```bash
git clone https://github.com/nebmit/note.git
```

#### Navigate to the project directory:
```bash
cd note
```

#### Install the dependencies:
```bash
npm install
```

#### Create a `.env` file in the root directory.
- Optionally, add `PORT=Your_Port` (e.g., `PORT=3000`).
- Add `ORIGIN=Your_Origin` (e.g., `ORIGIN=http://localhost:3000`).
- Add `VITE_SSO_URL=Your_SSO_URL` (e.g., `VITE_SSO_URL=http://localhost:8080`).

#### Build and start the application:
```bash
npm run build
npm start
```

The app will now run on your configured port or `http://localhost:3000/` by default.
