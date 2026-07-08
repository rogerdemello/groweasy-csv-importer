/** @type {import('next').NextConfig} */
const nextConfig = {
  // We run our own Express server (server/main.ts), so lint/build tooling stays lean.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
};

export default nextConfig;
