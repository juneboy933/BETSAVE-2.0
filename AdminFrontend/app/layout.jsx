import "./globals.css";
import { IBM_Plex_Mono, Manrope, Sora } from "next/font/google";

const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Sora({ subsets: ["latin"], variable: "--font-heading" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata = {
  title: "Betsave Admin Portal",
  description: "Admin operations and governance"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable}`}>
        <main className="mx-auto min-h-screen w-full px-4 py-6 sm:px-6 lg:w-[88vw] lg:px-8 xl:px-10">{children}</main>
      </body>
    </html>
  );
}
