import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import "./globals.css"
// Removed page/nav transitions to avoid dark flash during route changes
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Dancing_Script, Caveat } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import RouteProgress from "@/components/route-progress"

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
})

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
})

export const metadata: Metadata = {
  title: "C-FORGIA CRM — Amenity Forge",
  description:
    "C-FORGIA is a modern, AI‑powered CRM by Amenity Forge. Track leads, deals, and analytics in one fast, beautiful dashboard.",
  generator: "v0.app",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${dancingScript.variable} ${caveat.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Suspense fallback={null}>
            <RouteProgress />
            {children}
          </Suspense>
          <Toaster richColors position="top-center" />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
