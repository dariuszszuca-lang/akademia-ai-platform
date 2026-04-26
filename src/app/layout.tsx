import type { Metadata } from "next";
import localFont from "next/font/local";
import { Fraunces } from "next/font/google";
import "./globals.css";

const jakarta = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-jakarta",
  weight: "100 900",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Akademia AI",
  description: "Prywatna przestrzeń do nauki, wdrożeń i pracy z AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${jakarta.variable} ${fraunces.variable} h-full`}>
      <body className="font-sans antialiased min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
