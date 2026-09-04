import type { Metadata } from 'next'
import { Source_Serif_4, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ISBAT University ERP',
  description: 'Enterprise Resource Planning — Academic Module',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sourceSerif.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="stylesheet" href="https://cdn.lineicons.com/4.0/lineicons.css" />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
