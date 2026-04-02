import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { ColorThemeProvider } from '@/lib/color-theme'
import { Toaster } from '@/components/ui/sonner'
import { EdgeSwipeBack } from '@/components/edge-swipe-back'
import { SentryInit } from '@/components/sentry-init'
import { SessionTimeoutGuard } from '@/components/session-timeout-guard'
import './globals.css'

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Care Tracking',
  description: 'Track feeding, sleep, and diaper changes for your baby.',
  generator: 'Next.js',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://vpgdmrsgzlypfpjxtxmt.supabase.co https://*.sentry.io; font-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" themes={["light", "dim", "dark"]} disableTransitionOnChange>
          <ColorThemeProvider>
            <SentryInit />
            <SessionTimeoutGuard />
            <EdgeSwipeBack />
            {children}
            <Toaster position="bottom-center" />
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
