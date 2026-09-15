'use client';

// F30 관리자 로그인 뷰 — docs/design/관리자로그인.dc.html 디자인을 100% 그대로 옮겼다.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function AdminLoginView() {
  const router = useRouter();
  const [adminId, setAdminId] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('washed_admin_id') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [showError, setShowError] = useState(false);
  const [remember, setRemember] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(localStorage.getItem('washed_admin_id'));
    } catch {
      return false;
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!adminId.trim() || !password) {
      setShowError(true);
      return;
    }

    setPending(true);
    setShowError(false);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: adminId.trim(), password }),
      });

      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setShowError(true);
        return;
      }

      try {
        if (remember) {
          localStorage.setItem('washed_admin_id', adminId.trim());
        } else {
          localStorage.removeItem('washed_admin_id');
        }
      } catch {
        // 무시
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setShowError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F3F6FB] p-6 font-['Pretendard']">
      {/* 배경 원형 그라디언트 효과 */}
      <div
        className="pointer-events-none absolute -top-[260px] left-1/2 h-[820px] w-[820px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(91,147,224,0.14) 0%, rgba(91,147,224,0) 62%)',
        }}
      />

      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
        {/* 헤더 로고 영역 */}
        <div className="mb-[26px] flex w-full flex-col items-center">
          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[22px] bg-white shadow-[0_10px_24px_rgba(47,99,184,0.14),0_2px_6px_rgba(47,99,184,0.06)]">
            <img
              src="/icons/logo-mark.png"
              alt="Washed"
              className="h-[44px] w-[44px] object-contain"
            />
          </div>
          <div className="mt-4 whitespace-nowrap text-[30px] font-extrabold leading-[1.15] tracking-[-1px] text-[#2F63B8]">
            Washed <span className="text-[#1E3557]">관리자</span>
          </div>
          <div className="mt-[9px] whitespace-nowrap text-[13px] font-semibold tracking-[-0.2px] text-[#6B8CB8]">
            기기 · 대기열 · 신고 관리 콘솔
          </div>
        </div>

        {/* 로그인 카드 폼 */}
        <form
          onSubmit={handleLogin}
          className="w-full rounded-[24px] bg-white p-[26px_22px_22px] shadow-[0_14px_36px_rgba(47,99,184,0.12),0_2px_8px_rgba(47,99,184,0.05)]"
        >
          <label className="mb-2 block text-[13px] font-bold text-[#33456B]">
            관리자 아이디
          </label>
          <input
            type="text"
            value={adminId}
            onChange={(e) => {
              setAdminId(e.target.value);
              setShowError(false);
            }}
            placeholder="관리자 아이디를 입력해 주세요"
            className="h-[52px] w-full rounded-[14px] border-[1.5px] border-[#E3EBF7] bg-white px-4 text-[15px] font-medium text-[#1E3557] placeholder:font-normal placeholder:text-[#A8BCD9] focus:border-[#5B93E0] focus:shadow-[0_0_0_4px_rgba(91,147,224,0.14)] focus:outline-none"
          />

          <label className="mb-2 mt-[18px] block text-[13px] font-bold text-[#33456B]">
            비밀번호
          </label>
          <div className="relative">
            <input
              type={pwVisible ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setShowError(false);
              }}
              placeholder="비밀번호를 입력해 주세요"
              className="h-[52px] w-full rounded-[14px] border-[1.5px] border-[#E3EBF7] bg-white pl-4 pr-[44px] text-[15px] font-medium text-[#1E3557] placeholder:font-normal placeholder:text-[#A8BCD9] focus:border-[#5B93E0] focus:shadow-[0_0_0_4px_rgba(91,147,224,0.14)] focus:outline-none"
            />
            {password.length > 0 && (
              <button
                type="button"
                onClick={() => setPwVisible(!pwVisible)}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 p-1 text-[#8FAAD0] hover:text-[#5B93E0]"
              >
                {pwVisible ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="3" y1="21" x2="21" y2="3" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {showError && (
            <div className="mt-2.5 text-[12.5px] font-semibold text-[#E0554E]">
              아이디 또는 비밀번호가 올바르지 않습니다.
            </div>
          )}

          <div className="my-[16px] mb-[20px] flex items-center justify-between">
            <label className="relative flex cursor-pointer items-center gap-[9px] text-[13px] font-medium text-[#5A6E8F]">
              <input
                type="checkbox"
                checked={remember}
                onChange={() => setRemember(!remember)}
                className="peer absolute h-0 w-0 opacity-0"
              />
              <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-[6px] border-[1.5px] border-[#CFDDF2] bg-white transition-all peer-checked:border-[#5B93E0] peer-checked:bg-[#5B93E0]">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="opacity-0 transition-opacity peer-checked:opacity-100"
                >
                  <path
                    d="M2.5 6.3L4.8 8.6L9.5 3.7"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              아이디 저장
            </label>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="cursor-pointer whitespace-nowrap text-[13px] font-semibold text-[#2F63B8] hover:text-[#1F4E9C]"
            >
              비밀번호 재발급 문의
            </button>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="h-[54px] w-full cursor-pointer rounded-[14px] bg-gradient-to-b from-[#5B93E0] to-[#3B76CC] text-[16px] font-bold tracking-[-0.2px] text-white shadow-[0_8px_20px_rgba(47,99,184,0.28)] transition-all active:translate-y-[1px] active:shadow-[0_4px_12px_rgba(47,99,184,0.24)] disabled:opacity-60"
          >
            {pending ? '로그인 중…' : '로그인'}
          </button>
        </form>

        {/* 하단 일반 로그인 안내 */}
        <div className="mt-[22px] text-center text-[12.5px] font-medium leading-[1.6] text-[#6B8CB8]">
          관리자 계정은 기숙사 행정실에서 발급합니다.
          <br />
          <Link href="/login" className="font-bold text-[#2F63B8] hover:underline">
            일반 사용자 로그인
          </Link>
        </div>
      </div>

      {/* 행정실 비밀번호 재발급 안내 모달 (P12) */}
      {helpOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(20,42,84,0.42)] p-6">
          <div className="flex w-full max-w-[340px] flex-col gap-4 rounded-[18px] bg-white p-6 shadow-[0_20px_40px_-12px_rgba(20,42,84,0.4)]">
            <div className="flex flex-col gap-2 text-center">
              <span className="text-[16px] font-extrabold text-[#1E3557]">
                비밀번호 재발급 안내
              </span>
              <span className="text-[13px] leading-[1.6] text-[#5A6E8F]">
                관리자 계정 비밀번호 재발급은
                <br />
                기숙사 행정실에서 처리합니다.
              </span>
              <span className="mt-1 text-[19px] font-extrabold tracking-[-0.3px] text-[#2F63B8]">
                031-740-7700
              </span>
              <span className="text-[12px] text-[#6B8CB8]">평일 09:00 ~ 18:00</span>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="cursor-pointer rounded-[12px] bg-[#4C86D8] p-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
