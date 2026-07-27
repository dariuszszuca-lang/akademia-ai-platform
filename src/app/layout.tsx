import type { Metadata } from "next";
import localFont from "next/font/local";
import { Fraunces } from "next/font/google";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/product";
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
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${jakarta.variable} ${fraunces.variable} h-full dark`}>
      <body className="font-sans antialiased min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
