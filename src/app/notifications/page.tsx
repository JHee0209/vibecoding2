// 알림함 (F17 · F31) — 07 화면 목록 「알림함」.
// 종류 탭 · 날짜별 묶음 · 읽음 처리. 보관/조회 기간은 src/lib/notifications.ts 에 있다.

import { auth } from '@/auth';
import { TopBar } from '@/components/top-bar';
import { getNotifications } from '@/lib/notifications';

import { NotificationsView } from './notifications-view';

export default async function NotificationsPage() {
  const session = await auth();
  const rows = await getNotifications(session!.user!.id);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
      <TopBar title="알림" back="/home" />
      <NotificationsView rows={rows} />
    </main>
  );
}
