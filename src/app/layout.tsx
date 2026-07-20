import type { Metadata } from "next";
import { Manrope, Spectral } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { CaptureSheetProvider } from "@/components/CaptureSheet";
import { IntentEditorProvider } from "@/components/IntentEditorSheet";

// Body text — Manrope. Cyrillic subset is mandatory (Ukrainian UI).
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

// Display serif — Spectral. Used for headings and warm italic captions.
const spectral = Spectral({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Moment Planner",
  description: "AI day planner",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${manrope.variable} ${spectral.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <CaptureSheetProvider>
          <IntentEditorProvider>
            <div className="mx-auto flex min-h-screen max-w-md flex-col pb-24">{children}</div>
            <BottomNav />
          </IntentEditorProvider>
        </CaptureSheetProvider>
      </body>
    </html>
  );
}
