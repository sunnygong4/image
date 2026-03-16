import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { SiteHeader } from "@/components/site-header";
import { SITE_SHORT_BIO, SITE_TITLE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`,
  },
  description: SITE_SHORT_BIO,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell mx-auto min-h-screen max-w-7xl px-4 py-4 md:px-6 md:py-6">
          <SiteHeader />
          <main className="app-main pb-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
