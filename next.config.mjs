/** @type {import('next').NextConfig} */

function resolveBackendUrl() {
  // In local dev, always proxy to the local API so code changes apply immediately.
  if (process.env.NODE_ENV !== "production") {
    const explicit = process.env.BACKEND_URL?.replace(/\/$/, "");
    if (explicit) {
      if (explicit.includes("localhost:5000") || explicit.includes("127.0.0.1:5000")) {
        return "http://localhost:5001";
      }
      return explicit;
    }
    return "http://localhost:5001";
  }

  const raw = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001";
  const trimmed = String(raw).replace(/\/$/, "");
  if (trimmed.includes("localhost:5000") || trimmed.includes("127.0.0.1:5000")) {
    return "http://localhost:5001";
  }
  return trimmed;
}

const backendUrl = resolveBackendUrl();

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
    ];
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: backendUrl,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
