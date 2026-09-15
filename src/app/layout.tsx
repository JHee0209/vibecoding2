import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Washed",
  description: "기숙사 세탁기 · 건조기 원격 줄서기",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Washed",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/logo-mark.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="antialiased">
      <head>
        {/* 화면 원본(docs/design/*.dc.html)이 쓰는 글꼴. globals.css 의 --font-sans 첫 글꼴과 같다. */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-dvh bg-bg text-text">
        {children}

        {/*
          다국어(F37 · 05 P25) — docs/design/i18n.js 를 그대로 옮긴 것이다.
          한국어 원문을 키로 쓰는 런타임 번역기이고 <lang-picker> 도 여기서 정의된다.
          화면이 그려진 뒤에 붙어야 하므로 afterInteractive 로 둔다.
          (08 · 11번: 서버 렌더링으로 옮길 때 키 기반 파일로 바꾼다 — 그때까지는 이 방식이다.)
        */}
        <Script src="/i18n.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
