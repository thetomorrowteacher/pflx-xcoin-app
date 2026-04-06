import type { Metadata } from "next";
import "./globals.css";
import Ticker from "./components/Ticker";
import StoreProvider from "./components/StoreProvider";
import FullscreenToggle from "./components/FullscreenToggle";
import PflxBridge from "./components/PflxBridge";
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
      <body>
        <StoreProvider>
          {children}
          <Ticker />
          <FullscreenToggle />
          <PflxBridge />
          <CloudSaveIndicator />
        </StoreProvider>
      </body>
    </html>
  );
}
