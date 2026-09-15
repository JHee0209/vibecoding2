'use client';

// 아래 탭 — 홈 · 기록 · 설정 (07 흐름표 54줄).
// 스크롤 영역 **밖에** 있어야 스크롤에 딸려 올라가지 않는다.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/home', label: '홈' },
  { href: '/history', label: '기록' },
  { href: '/settings', label: '설정' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-shrink-0 justify-center gap-8 border-t border-primary-soft bg-surface py-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-1 rounded-md px-4 py-1 ${
              active ? 'bg-primary-soft' : ''
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-primary' : 'bg-text/30'}`} />
            <span
              className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-text/50'}`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
