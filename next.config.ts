import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Dev only: Next blocks dev assets (JS chunks, HMR) for any origin other than
// localhost, so a phone opening http://<this machine's LAN IP>:3000 gets the
// HTML but never hydrates. Allow this machine's current LAN addresses (read
// at startup, so it follows a network change after a restart).
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,

  // Prevent Next.js from bundling Sanity's server-side packages
  serverExternalPackages: ["@sanity/client", "sanity"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
};

export default nextConfig;
