// 관리자 로그인 API
// POST /api/admin/login { adminId, password }

import { setAdminSession, verifyAdminCredentials } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const adminId = typeof b.adminId === 'string' ? b.adminId : '';
  const password = typeof b.password === 'string' ? b.password : '';

  if (!adminId || !password) {
    return Response.json(
      { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
      { status: 401 },
    );
  }

  const isValid = await verifyAdminCredentials(adminId, password);
  if (!isValid) {
    return Response.json(
      { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
      { status: 401 },
    );
  }

  await setAdminSession(adminId);
  return Response.json({ ok: true });
}
