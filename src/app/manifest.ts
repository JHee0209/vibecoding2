import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Washed - 기숙사 세탁기 원격 줄서기',
    short_name: 'Washed',
    description: '기숙사 세탁기 · 건조기 원격 줄서기 및 푸시 알림',
    start_url: '/home',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icons/logo-mark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}

