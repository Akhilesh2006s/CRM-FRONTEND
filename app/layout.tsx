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
  title: "Viswam Edutech CRM",
  description:
    "Viswam Edutech CRM: leads, schools, DCs, expenses, attendance and reports in one place.",
  generator: "v0.app",
  icons: {
    icon: "/viswam-logo.png",
    shortcut: "/viswam-logo.png",
    apple: "/viswam-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
