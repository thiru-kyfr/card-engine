import type { NextConfig } from "next";
const nextConfig: NextConfig = { outputFileTracingIncludes: { "/**": ["./catalog/**/*"] } };
export default nextConfig;
