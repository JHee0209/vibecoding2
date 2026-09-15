// F11 — 설정 > 신고하기 접수 (05 P15 · 06 「신고」)
//
// POST { reason, machineKind, machineNo, etcContent }  →  { ok: true }
//
// 화면이 막는 것과 **같은 조건을 서버도 본다**(08 · 7번) — 기기 관련 세 사유는 종류 ·
// 호기가 필수, 「기타」는 기기를 고르지 않는다. 「세탁물 있음」은 증거 사진이 필수인데
// 업로드 저장소가 아직 없어(08 · 7번) 여기서 막는다 — DB 의 CHECK 도 같은 것을 막는다.

import { auth } from '@/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const REASONS = ['기기 고장', '순서 미준수', '세탁물 있음', '기타'] as const;
type Reason = (typeof REASONS)[number];

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const reason = b.reason as Reason;
  if (!REASONS.includes(reason)) {
    return Response.json({ ok: false, message: '신고 사유를 골라주세요.' }, { status: 400 });
  }

  // 05 P15 — 증거 사진이 있어야만 접수되는 사유다. 저장소가 생기면 이 자리를 푼다.
  if (reason === '세탁물 있음') {
    return Response.json(
      {
        ok: false,
        message: '증거 사진 업로드가 아직 준비 중이라 이 사유는 접수할 수 없어요.',
      },
      { status: 400 },
    );
  }

  const needsMachine = reason !== '기타';
  const machineKind = b.machineKind === '세탁기' || b.machineKind === '건조기' ? b.machineKind : null;
  const machineNo =
    typeof b.machineNo === 'number' && Number.isInteger(b.machineNo) && b.machineNo > 0
      ? b.machineNo
      : null;

  if (needsMachine && (machineKind === null || machineNo === null)) {
    return Response.json(
      { ok: false, message: '기기 종류와 호기를 골라주세요.' },
      { status: 400 },
    );
  }

  const etcContent =
    reason === '기타' && typeof b.etcContent === 'string' && b.etcContent.trim()
      ? b.etcContent.trim()
      : null;

  await sql`
    INSERT INTO reports (reporter_user_id, reason, machine_kind, machine_no, etc_content)
    VALUES (${userId}, ${reason}, ${needsMachine ? machineKind : null},
            ${needsMachine ? machineNo : null}, ${etcContent})
  `;

  return Response.json({ ok: true });
}
