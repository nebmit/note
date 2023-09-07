# SvelteKit Note-Taking App

This is a client-side encrypted note-taking application built with SvelteKit and styled using Tailwind CSS. Notes are stored in an SQLite3 database and are encrypted/decrypted on the client side.

## Key Points
- Client-side encryption and decryption.
- Notes are identified by the name provided during sign-in.
- No account creation necessary. Notes are generated on-the-fly.
- If the correct password is provided or the note is empty, you can edit it. Incorrect passwords for non-empty notes prevent decryption and editing.

## Setup

### Prerequisites
- Node.js (latest LTS version recommended)

### Installation

1. Clone the repo:
```bash
git clone https://github.com/nebmit/note.git
```

2. Navigate to the project directory:
```bash
cd note
```

3. Install the dependencies:
```bash
npm install
```

### Configuration

1. Set up a custom port (optional):
    - Create a `.env` file in the root directory.
    - Add `PORT=Your_Port_Number` (e.g., `PORT=8080`).

2. Build and start the application:

```bash
npm run build
npm start
```

The app will now run on your configured port or `http://localhost:3000/` by default.
