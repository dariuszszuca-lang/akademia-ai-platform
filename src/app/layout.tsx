import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Akademia AI — Platforma Szkoleniowa",
  description: "Praktyczne warsztaty AI dla agentów nieruchomości. Kursy, materiały, społeczność.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${inter.variable} ${cinzel.variable} h-full`}>
      <body className="font-sans antialiased min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
