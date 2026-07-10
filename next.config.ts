import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages — builds to /out as plain HTML/JS/CSS.
  output: "export",
  // next/image optimization needs a server; serve images as-is.
  images: { unoptimized: true },
};

export default nextConfig;
