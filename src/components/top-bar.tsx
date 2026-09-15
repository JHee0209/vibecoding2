// 상단 바 — 홈 · 기록 · 설정이 같은 규격을 쓴다 (07 「공통 인수 조건」).
// 오른쪽 종 아이콘은 안 읽은 알림이 있으면 점이 붙는다 (F18).
//
// 알림함은 규격이 달라(뒤로가기 + 제목) `back` · `title` 을 넘겨 쓴다.

import Image from 'next/image';
import Link from 'next/link';

type Props = {
  /** 알림함처럼 뒤로가기 + 제목으로 쓸 때 */
  title?: string;
  back?: string;
  /** 홈 · 기록 · 설정의 종 아이콘 점 (F18) */
  unreadCount?: number;
};

export function TopBar({ title, back, unreadCount = 0 }: Props) {
  if (back) {
    return (
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-primary-soft bg-surface px-4 py-3">
        {/* 디자인(알림.dc.html)의 뒤로가기 화살표 */}
        <Link href={back} aria-label="뒤로" className="flex h-6 w-6 items-center justify-center">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" aria-hidden>
            <path
              d="M9.5 1.5 1.5 9l8 7.5"
              stroke="#1E3557"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <span className="text-base font-black text-text">{title}</span>
      </header>
    );
  }

  return (
    <header className="flex flex-shrink-0 items-center justify-between border-b border-primary-soft bg-surface px-4 py-3">
      <div className="flex items-center gap-1">
        <Image src="/icons/logo-mark.png" alt="" width={28} height={28} />
        <span className="text-base font-black text-primary-strong">Washed</span>
      </div>
      <Link href="/notifications" aria-label="알림함" className="relative block h-6 w-6">
        <Image
          src={unreadCount > 0 ? '/icons/bell-active.svg' : '/icons/bell.svg'}
          alt=""
          fill
          sizes="24px"
        />
      </Link>
    </header>
  );
}
