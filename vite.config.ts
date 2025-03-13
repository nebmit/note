import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';

dotenv.config();
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit()]
});
