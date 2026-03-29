/** @type {import('next').NextConfig} */
const nextConfig = {
//  output: 'export',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Server-side only env vars (never sent to browser)
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyCOSOIT40FLTNk5_8LTmX_rEiPs56amn7I",
  },
};

export default nextConfig;
