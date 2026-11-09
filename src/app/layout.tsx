import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Public_Sans } from "next/font/google";
import Header from "@/components/Header";
import { SettingsProvider } from "@/lib/settings";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], display: "swap" });
// Assamese uses the Bengali script.
const notoBengali = Noto_Sans_Bengali({ variable: "--font-noto-bengali", subsets: ["bengali"], display: "swap" });

export const metadata: Metadata = {
  title: "Niyam Sahayak · Trusted rules assistant",
  description:
    "Answers for Government of Assam officers from approved documents only. Every sentence shows its source.",
};

export const viewport: Viewport = { themeColor: "#0f5e6e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${notoBengali.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col text-[16px]">
        <SettingsProvider>
          <Header />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  );
}
