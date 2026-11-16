import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";
import AsciiBackground from "@/components/AsciiBackground";
import SiteHeader from "@/components/header/SiteHeader";

const anonymousPro = localFont({
  src: [
    {
      path: "../../public/assets/fonts/AnonymousPro-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/AnonymousPro-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-anonymous",
  display: "swap",
});

const monigue = localFont({
  src: "../../public/assets/fonts/MoniguedemoRegular.otf",
  variable: "--font-monigue",
  weight: "400",
  style: "normal",
  display: "swap",
});

// HUD font of the installation (TV1/TV2).
const vcr = localFont({
  src: "../../public/assets/fonts/VCR_OSD_MONO.ttf",
  variable: "--font-vcr",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Core Website",
  description: "Core Website",
};

// Redesign: the old Header, IntroLoader and footer symbol are unmounted (files
// kept for now). The ASCII wave stays here so it survives navigations.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      // min-h-dvh, not min-h-screen: on phones 100vh is taller than the visible
      // area (URL bar), which made the page scroll a little.
      className={`${anonymousPro.variable} ${monigue.variable} ${vcr.variable} min-h-dvh flex flex-col antialiased`}
    >
      <AsciiBackground />
      <SiteHeader />
      {children}
    </div>
  );
}
