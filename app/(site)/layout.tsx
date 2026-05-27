import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";

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

export const metadata: Metadata = {
  title: "Core Website",
  description: "Core Website",
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${anonymousPro.variable} ${monigue.variable} min-h-screen flex flex-col antialiased`}
    >
      {children}
    </div>
  );
}
