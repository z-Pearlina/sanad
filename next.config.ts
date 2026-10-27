import type { NextConfig } from "next";

// Sanad is deployed as a static site (Render Static Site): `next build`
// writes plain HTML/CSS/JS into `out/`. All data is pre-built JSON in
// public/data; hadith text is also fetched live from the Ummah API.
const nextConfig: NextConfig = {
  output: "export",
  // /name -> /name/index.html, so any static host serves it without rewrites
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
