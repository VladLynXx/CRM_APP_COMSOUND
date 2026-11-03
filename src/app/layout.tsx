import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./brand.css";
import "./scanner.css";
import "./shipping.css";

export const metadata: Metadata = {
  title: "COMSOUND — производственный контур",
  description: "Заявки, конструкторский отдел, КД, раскрои и прослеживаемость производства звукоизоляционных конструкций.",
};

export const viewport: Viewport = {
  themeColor: "#071426",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
