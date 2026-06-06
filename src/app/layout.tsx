import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Artifex Studio",
  description: "Local image generation studio for the Artifex SDXL engine.",
};

export const viewport: Viewport = { themeColor: "#0a0f0e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
