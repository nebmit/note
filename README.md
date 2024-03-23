# SvelteKit Note-Taking App

## Overview

This SvelteKit Note-Taking App is a client-side encrypted application for securely managing notes. Built with SvelteKit and styled with Tailwind CSS, it prioritizes user privacy by ensuring all notes are encrypted and decrypted on the client side. The back-end relies on an SQLite3 database to store note information, linking them to individual user accounts.

## Features

- **Client-Side Encryption/Decryption**: Ensures your notes are secure and private.
- **User Identification**: Notes are linked to users based on the account information provided at sign-in.
- **Seamless Note Management**: No need to create an account. Notes are generated and accessible immediately, on-the-fly.
- **Security**: Only the correct password or an empty note allows for editing. Incorrect passwords prevent access to note content, safeguarding against unauthorized modifications.

## Getting Started

### Prerequisites

Ensure you have the latest LTS version of Node.js installed on your machine to run the application smoothly.

### Installation

1. **Clone the repository**

   Use Git to clone the project's repository into your local machine:

   ```bash
   git clone https://github.com/nebmit/note.git
   ```

2. **Navigate to the project directory**

   Change into the project's directory:

   ```bash
   cd note
   ```

3. **Install Dependencies**

   Run the following command to install the necessary dependencies:

   ```bash
   npm install
   ```

4. **Environment Configuration**

   Create a `.env` file in the root directory and configure the following variables:

   - `PORT=Your_Port` (Optional, defaults to `3000`, e.g., `PORT=3000`)
   - `ORIGIN=Your_Origin` (Required, e.g., `ORIGIN=http://localhost:3000`)
   - `VITE_SSO_URL=Your_SSO_URL` (Required for single sign-on, e.g., `VITE_SSO_URL=http://localhost:8080`)

### Running the Application

After setting up, you can build and start the application using:

```bash
npm run build
npm start
```

Your app will be accessible on the configured port or by default at `http://localhost:3000/`.
