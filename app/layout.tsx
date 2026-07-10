import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everest Collective — Client Portal",
  description: "Client partnership workspace by Everest Collective.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
