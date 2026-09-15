'use client';

// F38 로그인 — 07-screens.md 흐름표 36 · 37 · 38 · 41 · 42 줄.
//
// 아직 없는 것 — 구글 계속하기(F39). 화면을 정식으로 만들 때
// docs/design/로그인.dc.html 을 따라 채운다.
//
// auth.ts 의 authorize 는 이메일이 없음 · 형식이 아님 · 비밀번호가 비었음(구글 전용) ·
// 비밀번호 틀림을 전부 null 로 통일해 돌려주므로, next-auth 가 주는 에러도 하나뿐이다
// (CredentialsSignin). "구글 계정으로 로그인해주세요" 처럼 사유별 문구를 나누려면
// authorize 가 실패 사유를 함께 내려주도록 먼저 고쳐야 한다.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await signIn('credentials', { email, password, redirect: false });

    setPending(false);
    if (result?.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      return;
    }
    router.push('/home');
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[var(--screen-width)] flex-col gap-6 p-6">
      {/* F37 언어 버튼 — 디자인대로 오른쪽 위에 둔다 (05 P25) */}
      <div className="flex justify-end pt-2">
        <lang-picker align="right" />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="text-center">
          <h1 className="text-xl font-black text-primary-strong">Washed</h1>
          <p className="text-sm text-text">세탁기 · 건조기 원격 줄서기</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="아이디를 입력해 주세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[var(--control-height)] rounded-md border border-primary-soft bg-surface px-4 text-base text-text outline-primary"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="비밀번호를 입력해 주세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-[var(--control-height)] rounded-md border border-primary-soft bg-surface px-4 text-base text-text outline-primary"
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-[var(--control-height)] rounded-md bg-primary text-base font-bold text-surface disabled:opacity-60"
          >
            로그인
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 text-sm">
          <Link href="/password-reset" className="text-text/60">
            비밀번호 찾기
          </Link>
          <span className="text-text/25">|</span>
          <Link href="/signup" className="font-bold text-primary-strong">
            회원가입
          </Link>
          <span className="text-text/25">|</span>
          <Link href="/admin/login" className="text-text/60">
            관리자
          </Link>
        </div>
      </div>
    </main>
  );
}
