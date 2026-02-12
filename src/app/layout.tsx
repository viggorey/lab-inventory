import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Lab Inventory System",
  description: "A system for managing laboratory inventory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-blue-50">
      <body className="antialiased bg-blue-50 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}