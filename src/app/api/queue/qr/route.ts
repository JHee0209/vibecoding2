// F8 — 배정된 기기의 "QR 인증" 누름
// POST { kind: '세탁기' | '건조기' }  →  { ok: true }

import { auth } from '@/auth';
import { confirmQr, QueueError, type MachineKind } from '@/lib/queue';

export const runtime = 'nodejs';

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

  const kind = (body as Record<string, unknown>)?.kind as MachineKind;
  if (kind !== '세탁기' && kind !== '건조기') {
    return Response.json({ ok: false, message: '기기 종류가 올바르지 않아요.' }, { status: 400 });
  }

  try {
    await confirmQr(userId, kind);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof QueueError) {
      return Response.json({ ok: false, message: error.message }, { status: 400 });
    }
    console.error('QR 인증 실패', error);
    return Response.json({ ok: false, message: '잠시 뒤 다시 시도해주세요.' }, { status: 500 });
  }
}
