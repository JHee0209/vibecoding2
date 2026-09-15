// 관리자 인증 및 세션 검증 (F30 · 06 「관리자 계정」 · 05 P12)
import 'server-only';

import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { verify } from '@/lib/hash';

const ADMIN_COOKIE_NAME = 'washed_admin_token';
const ADMIN_SECRET = process.env.AUTH_SECRET || 'washed_admin_default_secret_key_2026';

// 디자인 시안(관리자로그인.dc.html)과 DB 계정 둘 다 지원
const FALLBACK_ADMIN = {
  loginId: 'eulji-university-dorm',
  password: 'eulji-seongnam',
};

export async function verifyAdminCredentials(loginId: string, password: string): Promise<boolean> {
  const trimmedId = loginId.trim();

  // 1. 디자인 시안 기본 계정 확인
  if (trimmedId === FALLBACK_ADMIN.loginId && password === FALLBACK_ADMIN.password) {
    return true;
  }

  // 2. DB admin_accounts 테이블 확인
  try {
    const rows = await sql<{ login_id: string; password_hash: string }>`
      SELECT login_id, password_hash
        FROM admin_accounts
       WHERE login_id = ${trimmedId}
       LIMIT 1
    `;
    if (rows.length > 0) {
      const match = await verify(password, rows[0].password_hash);
      if (match) return true;
    }
  } catch (error) {
    console.error('관리자 계정 조회 실패:', error);
  }

  return false;
}

export async function setAdminSession(loginId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = Buffer.from(`${loginId}:${ADMIN_SECRET}`).toString('base64');

  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7일 유지
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [loginId, secret] = decoded.split(':');
    return Boolean(loginId) && secret === ADMIN_SECRET;
  } catch {
    return false;
  }
}
