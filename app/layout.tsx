import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bid Estimation",
  description: "AI-adjusted bid effort, token cost and timeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
