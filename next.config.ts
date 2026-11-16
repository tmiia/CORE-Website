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

  // The Sanity client stays out of the server bundle. Not `sanity` (the
  // Studio): loaded with Node's require, it brings its own React, not the one
  // Next renders with, and the Studio's server render fails ("useMemoCache").
  serverExternalPackages: ["@sanity/client"],

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
