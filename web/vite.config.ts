import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// Allow access through a Cloudflare quick tunnel (cloudflared tunnel --url http://localhost:5173).
	server: {
		allowedHosts: ['.trycloudflare.com']
	},
	ssr: {
		noExternal: ['layerchart']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// start.sh serves the production build with `node build`.
			adapter: adapter(),

			// start.sh sets ORIGIN to the tunnel URL, so also accept form posts made on this machine.
			csrf: { trustedOrigins: ['http://localhost:5173'] },

			// Share the repository's .env with the Go server.
			env: { dir: '..' }
		})
	]
});
