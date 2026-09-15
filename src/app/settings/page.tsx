// 설정 (F11 · F16 · F36) — 07 화면 목록 「설정」 · docs/design/설정.dc.html.
//
// 디자인에 있지만 **일부러 만들지 않은 것 셋**
//   · 알림 종류별 토글(차례 10분 전 · 이용 가능) — F19 는 v2 다(04 · 06 「검토했으나 제외」).
//     대신 05 P26 이 요구하는 "알림이 꺼져 있어요" 줄만 뒀다.
//   · 「언어」 묶음(F37) — 번역 사전(i18n)이 아직 없다. 버튼만 두면 눌러도 아무 일이
//     일어나지 않으므로 묶음째 뺐다.
//   · 문의하기(F21 · v2) · 프로필 수정(F20 · v2) — 화면 자체가 MVP 밖이다.

import { auth, signOut } from '@/auth';
import { BottomNav } from '@/components/bottom-nav';
import { TopBar } from '@/components/top-bar';
import { sql } from '@/lib/db';
import { daysLeftUntil } from '@/lib/format';
import { getUnreadCount } from '@/lib/notifications';

import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [[profile], [restriction], unreadCount] = await Promise.all([
    sql<{ name: string; student_id: string; room: string }>`
      SELECT name, student_id, room FROM users WHERE user_id = ${userId}
    `,
    sql<{ warning_count: number; restricted_until: string | null }>`
      SELECT warning_count, restricted_until FROM usage_restrictions WHERE user_id = ${userId}
    `,
    getUnreadCount(userId),
  ]);

  async function onSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
      <TopBar unreadCount={unreadCount} />

      <SettingsView
        name={profile?.name ?? ''}
        studentId={profile?.student_id ?? ''}
        room={profile?.room ?? ''}
        warningCount={restriction?.warning_count ?? 0}
        restrictedDaysLeft={
          restriction?.restricted_until ? daysLeftUntil(restriction.restricted_until) : 0
        }
        onSignOut={onSignOut}
      />

      <BottomNav />
    </main>
  );
}
