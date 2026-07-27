import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter(),
        csp: {
            mode: 'nonce',
            directives: {
                'default-src': ['self'],
                'script-src': ['self'],
                // Svelte transitions create inline style elements.
                'style-src': ['self', 'unsafe-inline'],
                'connect-src': ['self'],
                'font-src': ['self'],
                'img-src': ['self'],
                'object-src': ['none'],
                'base-uri': ['none'],
                'frame-ancestors': ['none'],
                'form-action': ['self']
            }
        }
    },
    preprocess: vitePreprocess()
};
export default config;
