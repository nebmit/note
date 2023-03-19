import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'fs';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		https: {
			cert: fs.readFileSync("ssl\\cert.pem"),
			key: fs.readFileSync("ssl\\key.pem"),
		},
	},
});
