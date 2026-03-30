import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { SiteFooter } from "@/components/site-footer";
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
        <SiteHeader />
        <div className="app-shell mx-auto min-h-screen max-w-7xl px-4 pb-4 pt-20 md:px-6 md:pb-6 md:pt-24">
          <main className="app-main pb-12">{children}</main>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
