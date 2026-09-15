// F3 · F4 (POST — 줄서기) · F7 (DELETE — 줄 빠지기)
//
// POST   { kind: '세탁기' | '건조기' }  →  { ok: true }
// DELETE { kind: '세탁기' | '건조기' }  →  { ok: true }

import { auth } from '@/auth';
import { joinQueue, leaveQueue, QueueError, type MachineKind } from '@/lib/queue';

export const runtime = 'nodejs';

function readKind(body: unknown): MachineKind | null {
  const kind = (body as Record<string, unknown>)?.kind;
  return kind === '세탁기' || kind === '건조기' ? kind : null;
}

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

  const kind = readKind(body);
  if (!kind) return Response.json({ ok: false, message: '기기 종류가 올바르지 않아요.' }, { status: 400 });

  try {
    await joinQueue(userId, kind);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof QueueError) {
      return Response.json({ ok: false, message: error.message }, { status: 400 });
    }
    console.error('줄서기 실패', error);
    return Response.json({ ok: false, message: '잠시 뒤 다시 시도해주세요.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const kind = readKind(body);
  if (!kind) return Response.json({ ok: false, message: '기기 종류가 올바르지 않아요.' }, { status: 400 });

  try {
    await leaveQueue(userId, kind);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof QueueError) {
      return Response.json({ ok: false, message: error.message }, { status: 400 });
    }
    console.error('줄 빠지기 실패', error);
    return Response.json({ ok: false, message: '잠시 뒤 다시 시도해주세요.' }, { status: 500 });
  }
}
