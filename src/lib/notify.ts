// 알림함 기록 + 폰 알림을 한 자리에서 만든다 (06 「알림」 · 05 P26).
//
// "허용하지 않았거나 구독이 끊긴 사람에게는 알림함에만 남는다 — 보낼 곳이 없을 뿐
// 기록은 똑같이 만든다"(P26) — 그래서 notifications INSERT 는 항상 하고,
// 푸시 발송은 그 뒤에 별도로(실패해도 알림함 기록에는 영향이 없게) 시도한다.

import 'server-only';

import { sql } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';

type NotificationKind = '공지' | '배정' | '종료' | '경고' | '결과';

export async function notify(
  userId: string,
  kind: NotificationKind,
  title: string,
  body: string,
): Promise<void> {
  await sql`
    INSERT INTO notifications (user_id, kind, title, body)
    VALUES (${userId}, ${kind}, ${title}, ${body})
  `;

  await sendPushToUser(userId, { title, body, url: '/home' });
}
