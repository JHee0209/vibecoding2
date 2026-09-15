// F14 · F15 · F39 회원가입 — docs/design/회원가입.dc.html.
//
// 구글로 처음 들어온 사람은 **화면을 늘리지 않고** 이 화면의 「구글 모드」로 온다
// (07 화면 목록 · 05 P11): 아이디 · 인증코드 · 비밀번호 · 비밀번호 확인 네 칸이
// 숨고 이름이 구글 값으로 채워진 채 열린다. 구분은 세션의 pendingSignup 이다.

import { auth } from '@/auth';

import { SignupForm } from './signup-form';

export default async function SignupPage() {
  const session = await auth();
  const googleMode = Boolean(session?.pendingSignup);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-primary-soft bg-surface px-5 py-3">
        <span className="text-base font-black text-primary-strong">Washed</span>
      </header>

      <SignupForm
        googleMode={googleMode}
        googleName={session?.user?.name ?? ''}
        googleEmail={session?.user?.email ?? ''}
      />
    </main>
  );
}
