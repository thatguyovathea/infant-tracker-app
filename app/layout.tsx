import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { ColorThemeProvider } from '@/lib/color-theme'
import { Toaster } from '@/components/ui/sonner'
import { EdgeSwipeBack } from '@/components/edge-swipe-back'
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
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" themes={["light", "dim", "dark"]} disableTransitionOnChange>
          <ColorThemeProvider>
            <EdgeSwipeBack />
            {children}
            <Toaster position="bottom-center" />
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
