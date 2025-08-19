import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import ClerkFirebaseSync from '../components/ClerkFirebaseSync';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Reduces CLS and font loading issues
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // Reduces CLS and font loading issues
});

export const metadata: Metadata = {
  title: "Team Inbox",
  description: "Minimal team task management with ICE prioritization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ClerkFirebaseSync />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
