"use client";

import { NextStudio } from "next-sanity/studio";
import config from "@/sanity/sanity.config";
import { hasSanityConfig } from "@/sanity/lib/env";

export default function StudioPage() {
  if (!hasSanityConfig) {
    return (
      <main className="p-6 font-sans">
        <h1>Sanity Studio is not configured</h1>
        <p>Add NEXT_PUBLIC_SANITY_PROJECT_ID to enable the Studio.</p>
      </main>
    );
  }

  return <NextStudio config={config} />;
}
