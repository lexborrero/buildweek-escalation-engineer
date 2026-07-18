import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "DevRelay",
    description:
      "Turn customer escalations into repository-backed engineering tickets.",
    openGraph: {
      title: "DevRelay",
      description: "Repository evidence. Engineering-ready tickets.",
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og-devrelay.png`,
          width: 1730,
          height: 909,
          alt: "DevRelay turns customer signals and repository evidence into engineering-ready action.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "DevRelay",
      description: "Repository evidence. Engineering-ready tickets.",
      images: [`${origin}/og-devrelay.png`],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
