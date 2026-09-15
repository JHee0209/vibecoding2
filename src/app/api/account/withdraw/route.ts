// F36 — 회원탈퇴 신청 · 취소 (05 P24 · 06 「사용자」의 탈퇴 신청 시각)
//
// POST   →  탈퇴 신청 (withdraw_requested_at = now). 14일 동안 되돌릴 수 있다.
// DELETE →  신청 취소 (복구). 홈의 복구 안내에서 부른다.
//
// **14일이 지난 계정을 실제로 지우는 것은 서버 배치다**(08 · 9번) — 아직 없다.
// 여기서는 시각만 남긴다.

import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { releaseUserQueues } from '@/lib/queue';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });

  await sql`
    UPDATE users SET withdraw_requested_at = now()
     WHERE user_id = ${userId} AND withdraw_requested_at IS NULL
  `;

  // 05 P24 — 탈퇴를 신청하면 즉시 이용이 정지된다.
  // 쥐고 있던 기기는 돌려주고 다음 대기자에게 넘긴다.
  await releaseUserQueues(userId);

  return Response.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });

  await sql`UPDATE users SET withdraw_requested_at = NULL WHERE user_id = ${userId}`;

  return Response.json({ ok: true });
}
