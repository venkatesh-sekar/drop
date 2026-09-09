import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@drop/core"],
  // postgres.js and the S3 client are Node-only; keep them out of the server bundle.
  serverExternalPackages: ["postgres", "@aws-sdk/client-s3"],
}

export default nextConfig
