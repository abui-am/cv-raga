import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  distDir: process.env.CVRAGA_TEST_SERVER === "1" ? ".next-test" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
  redirects() {
    return [
      { source: "/profile", destination: "/career", permanent: false },
      {
        source: "/knowledge",
        destination: "/career?section=evidence",
        permanent: false,
      },
    ];
  },
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
