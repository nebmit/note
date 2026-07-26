// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SsoUser } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: SsoUser | null;
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
