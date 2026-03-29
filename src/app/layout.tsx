import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Idea Hub — Turn Ideas Into Reality",
  description:
    "Discover, validate, and execute ideas using AI-driven workflows and a credit-based economy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <span className="text-2xl">💡</span>
                <span className="text-xl font-bold text-gray-900">
                  AI Idea Hub
                </span>
              </a>
              <div className="flex items-center gap-6">
                <a
                  href="/search"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Explore Ideas
                </a>
                <a
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </a>
                <a
                  href="/ideas/new"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Submit Idea
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
