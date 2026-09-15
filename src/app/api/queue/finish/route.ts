// F10 — "다했어요" 누름 (사용중이든 수거대기든 언제나 누를 수 있다 · 홈.dc.html finish())
// POST { kind: '세탁기' | '건조기' }  →  { ok: true }

import { auth } from '@/auth';
import { finishUsage, QueueError, type MachineKind } from '@/lib/queue';

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
    await finishUsage(userId, kind);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof QueueError) {
      return Response.json({ ok: false, message: error.message }, { status: 400 });
    }
    console.error('다했어요 처리 실패', error);
    return Response.json({ ok: false, message: '잠시 뒤 다시 시도해주세요.' }, { status: 500 });
  }
}
