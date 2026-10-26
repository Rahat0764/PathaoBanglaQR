import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bangla QR — made by Rahat",
  description: "Generate beautiful dynamic Bangla QR codes with custom amounts",
  authors: [{ name: "Rahat", url: "https://www.linkedin.com/in/RahatAhmedX" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn">
      <body className="min-h-dvh antialiased bg-mesh text-slate-100">
        {children}
      </body>
    </html>
  );
}
