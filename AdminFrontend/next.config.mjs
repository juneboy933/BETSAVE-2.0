import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiBase = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
const basePath = String(process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  ...(basePath ? { basePath } : {}),
  async rewrites() {
    if (!apiBase) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
