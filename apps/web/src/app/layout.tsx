import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TGS3 - Telegram S3 Storage",
  description: "Use Telegram as S3-compatible object storage",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force dynamic rendering so env vars are read at runtime, not baked at build time
  await headers();

  const adminApiUrl =
    (process.env.ADMIN_API_URL ||
      `http://localhost:${process.env.ADMIN_API_PORT || "3001"}`) + "/api";
  const s3ApiUrl =
    process.env.S3_API_URL ||
    `http://localhost:${process.env.S3_API_PORT || "4000"}`;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__TGS3_CONFIG__=${JSON.stringify({ adminApiUrl, s3ApiUrl })}`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
