import React from 'react';
import 'katex/dist/katex.min.css';
import '@ai-chat-suite/core/styles.css';
import '../styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Chat Suite - Embeddable Framework Demo',
  description: 'A modular, embeddable Claude.ai-style chat suite with skills, sandboxed workspace, and artifacts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased overflow-hidden bg-white dark:bg-[#141415]">
        {children}
      </body>
    </html>
  );
}
