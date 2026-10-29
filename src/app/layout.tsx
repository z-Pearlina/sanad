import type { Metadata, Viewport } from "next";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/aref-ruqaa/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "سَنَد · رجال صحيح البخاري في الزمان والمكان",
  description: "كل حديث من صحيح البخاري مع رجال سنده، وحكم ابن حجر على كل راوٍ بلفظه، والسند على الخريطة وعلى خط الزمن.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe5cf" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1610" },
  ],
};

// The home page is the full-screen map with its own masthead; the other pages
// get the site header from app/(site)/layout.tsx.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col bg-raqq text-midad">{children}</body>
    </html>
  );
}
