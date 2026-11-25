import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./ds.css";
import "./globals.css";

export const metadata: Metadata = { title: "Design system review", robots: { index: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="comfortable-light">
      <body>{children}</body>
    </html>
  );
}
