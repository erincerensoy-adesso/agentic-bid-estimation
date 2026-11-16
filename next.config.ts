import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "unpdf", "mammoth"],
};

export default nextConfig;
