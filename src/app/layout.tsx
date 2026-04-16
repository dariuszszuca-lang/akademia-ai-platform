import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const jakarta = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-jakarta",
  weight: "100 900",
});

const display = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-display",
  weight: "100 900",
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
    <html lang="pl" className={`${jakarta.variable} ${display.variable} h-full`}>
      <body className="font-sans antialiased min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
