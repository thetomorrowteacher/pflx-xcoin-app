import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Ticker from "./components/Ticker";
import StoreProvider from "./components/StoreProvider";
import FullscreenToggle from "./components/FullscreenToggle";
import PflxBridge from "./components/PflxBridge";
import PflxIframeGuard from "./components/PflxIframeGuard";
import CloudSaveIndicator from "./components/CloudSaveIndicator";

export const metadata: Metadata = {
  title: "PFLX X-Coin",
  description: "PFLX X-Coin (XC) & Digital Badge Management Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/*
        PFLX shared sub-app bootstrap — sets PFLX_APP_KEY then loads the
        bootstrap from the pathway-portal CDN so the cohort access gate
        runs before the page renders. Single source of truth lives in
        pathway-portal/public/pflx-app-bootstrap.js.
      */}
      <Script id="pflx-app-key" strategy="beforeInteractive">
        {`window.PFLX_APP_KEY = 'xcoin';`}
      </Script>
      <Script
        src="https://pflx-pathway-portal.vercel.app/pflx-app-bootstrap.js"
        strategy="beforeInteractive"
      />
      <body>
        <StoreProvider>
          {children}
          <Ticker />
          <FullscreenToggle />
          <PflxBridge />
          <PflxIframeGuard />
          <CloudSaveIndicator />
        </StoreProvider>
      </body>
    </html>
  );
}
