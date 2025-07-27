import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
      },
      manifest: {
        name: "Dilettante",
        short_name: "Dilettante",
        description:
          "I am a dabbler. An Imposter. A loose net of chaotic thoughts. A wild deck of scribbly notes. Until one day the time will come, Nietzsche's shadow flickers in candlelight, Kant's whisper stirs in margins of midnight. Awaiting as we all are, an optimistic Schopenhauer.",
        theme_color: "#0A84FF",
        background_color: "#FAFAFA",
        display: "standalone",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
