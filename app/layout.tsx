import type { Metadata } from "next";
import "./globals.css";
import Ticker from "./components/Ticker";

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
        {children}
        <Ticker />
      </body>
    </html>
  );
}
