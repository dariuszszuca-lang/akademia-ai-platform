import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
    <html lang="pl" className={`${jakarta.variable} h-full`}>
      <body className="font-sans antialiased min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
