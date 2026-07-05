import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Dinaikkan untuk payload base64 (foto OCR & pesan suara) ke server action.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
