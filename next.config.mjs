/** @type {import('next').NextConfig} */

function resolveBackendUrl() {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5001";
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
