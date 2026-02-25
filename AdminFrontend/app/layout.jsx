import "./globals.css";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });

export const metadata = {
  title: "Betsave Admin Portal",
  description: "Admin operations and governance"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <main className="mx-auto min-h-screen w-full px-4 py-6 sm:px-6 lg:w-[80vw] lg:px-8 xl:px-10">{children}</main>
      </body>
    </html>
  );
}
