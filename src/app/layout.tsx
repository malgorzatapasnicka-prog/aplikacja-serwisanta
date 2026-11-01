import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "../components/AuthGate";
import { SynchronizacjaOffline } from "@/components/SynchronizacjaOffline";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM serwisanta",
  description: "Klienci i zlecenia serwisowe",
  applicationName: "Radwin Serwis",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Radwin Serwis",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2447",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <AuthGate>
          <SynchronizacjaOffline />
          <div className="flex min-h-full flex-col md:flex-row">
            <AppNav />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}