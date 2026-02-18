import "./globals.css";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });

export const metadata = {
  title: "Betsave Partner Portal",
  description: "Partner integration and savings monitoring"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10">{children}</main>
      </body>
    </html>
  );
}
