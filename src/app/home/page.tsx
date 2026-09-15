// F1 홈 화면 — 기기 현황과 줄서기 (PRD 5절 「제작 순서」 3번).
// docs/design/홈.dc.html 을 서버 데이터로 옮겼다. QR 스캐너는 08-deployNOTE.md
// 6번이 이미 적어 둔 대로 카메라 없는 연출 화면 그대로다 — 실제 QR 디코딩은
// 별도 작업이다.
//
// 탈퇴 대기 중인 사람은 홈 대신 복구 안내를 본다 (05 P24 · 07 흐름표 60줄).
// auth.ts 의 authorize 가 "여기서 막지 않고 통과시킨 뒤 홈 진입에서 가른다" 고
// 적어 둔 그 자리다.

import { auth } from '@/auth';
import { BottomNav } from '@/components/bottom-nav';
import { TopBar } from '@/components/top-bar';
import { sql } from '@/lib/db';
import { daysLeftAfter } from '@/lib/format';
import { getUnreadCount } from '@/lib/notifications';
import { getHomeData } from '@/lib/queue';
import { startBackgroundScheduler } from '@/lib/scheduler';

import { HomeView } from './home-view';
import { NotificationPrompt } from './notification-prompt';
import { WithdrawNotice } from './withdraw-notice';

export default async function HomePage() {
  startBackgroundScheduler();

  const session = await auth();
  const userId = session!.user!.id;

  const [account] = await sql<{ withdraw_requested_at: string | null }>`
    SELECT withdraw_requested_at FROM users WHERE user_id = ${userId}
  `;

  if (account?.withdraw_requested_at) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
        <TopBar unreadCount={0} />
        {/* 05 P24 — 탈퇴 신청 + 14일까지 되돌릴 수 있다 */}
        <WithdrawNotice daysLeft={daysLeftAfter(account.withdraw_requested_at, 14)} />
      </main>
    );
  }

  const [{ machines, typeSummaries }, unreadCount] = await Promise.all([
    getHomeData(userId),
    getUnreadCount(userId),
  ]);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
      <TopBar unreadCount={unreadCount} />

      <HomeView
        userName={session?.user?.name ?? session?.user?.email ?? ''}
        machines={machines}
        typeSummaries={typeSummaries}
      />

      <BottomNav />
      <NotificationPrompt />
    </main>
  );
}
