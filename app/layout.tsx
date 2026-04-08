import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "La Manufacture RH",
  description: "Dashboard de pilotage - La Manufacture RH",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <div className="flex min-h-screen">
          <div className="hidden lg:block">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-auto min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
