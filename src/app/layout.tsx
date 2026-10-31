import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Permanent_Marker } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas", display: "swap" });
const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-permanent-marker",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Baga Trainer",
  description: "Treino das estratégias do time Baga",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bebas.variable} ${marker.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
