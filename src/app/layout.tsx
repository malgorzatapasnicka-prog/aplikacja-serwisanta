import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "CRM serwisanta",
  description: "Klienci i zlecenia serwisowe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthGate>
          <div className="flex min-h-full flex-col md:flex-row">
            <AppNav />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}