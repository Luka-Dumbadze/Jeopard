import type { Metadata } from "next";
import { Libre_Baskerville } from "next/font/google";
import "./globals.css";

const jeopardyFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jeopardy",
});

export const metadata: Metadata = {
  title: "Jeopardy Trivia",
  description: "Interactive Jeopardy-style trivia game board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jeopardyFont.variable} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
