import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Core.fm",
    default: "Core.fm | L'installation interactive",
  },
  description: "Core.fm une installation interactive qui redonne à la musique tout son sens.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
