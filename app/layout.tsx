import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { startWsServer } from "@/utils/wsServer";

// Start WebSocket server on backend initialization
if (typeof window === "undefined") {
  startWsServer();
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3D Satellite Tracker - Real-Time Orbit Visualizer",
  description: "Propagate and track satellites in 3D using Celestrak databases and SGP4 orbital mechanics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
