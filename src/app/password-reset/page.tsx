'use client';

// F35 비밀번호 찾기 — docs/design/비밀번호찾기.dc.html 을 그대로 옮겼다.
// 3단계(이메일 확인 → 인증 → 새 비밀번호) + 완료 화면 · 05 P22 · P12.
//
// 프로토타입은 코드가 `static CODE = '135790'` 으로 박혀 있었지만 여기서는
// 서버가 만들고 메일로 보낸다(08 · 1번 「이미 옮긴 것」):
//   POST /api/auth/password-reset/send-code   { email }          → { minutes }
//   POST /api/auth/password-reset/verify-code { email, code }    → { ticket }
//   POST /api/auth/password-reset             { email, ticket, password }
// 코드는 어떤 응답에도 들어오지 않는다.

import { useEffect, useState } from 'react';
import Link from 'next/link';

const LIMIT_MS = 5 * 60 * 1000; // 05 P22 — 재설정 코드는 5분

type Step = 1 | 2 | 3 | 4;

const STEPS: { no: Step; label: string }[] = [
  { no: 1, label: '이메일 확인' },
  { no: 2, label: '인증' },
  { no: 3, label: '새 비밀번호' },
];

export default function PasswordResetPage() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  const [emailError, setEmailError] = useState(false);
  const [codeErrorText, setCodeErrorText] = useState('');
  const [pending, setPending] = useState(false);

  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.ac\.kr$/i.test(email.trim());
  const remain = sentAt ? Math.max(0, LIMIT_MS - (now - sentAt)) : 0;
  const mm = String(Math.floor(remain / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');

  const pwLongEnough = pw1.length >= 8;
  const pwMatch = pw1 !== '' && pw1 === pw2;
  const pwMessage =
    pw1 === ''
      ? ''
      : !pwLongEnough
        ? '비밀번호는 8자 이상이어야 해요.'
        : pw2 === ''
          ? ''
          : pwMatch
            ? '비밀번호가 일치해요.'
            : '비밀번호가 일치하지 않아요.';

  async function sendCode() {
    if (email.trim() === '') return;
    if (!emailValid) {
      setEmailError(true);
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/auth/password-reset/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; devCode?: string };
      if (!data.ok) {
        setCodeErrorText(data.message ?? '인증코드를 보내지 못했어요.');
        return;
      }
      if (data.devCode) {
        console.log(`%c[Washed 인증코드] >> ${data.devCode} <<`, 'color: #2F63B8; font-size: 16px; font-weight: bold;');
      }
      setSentAt(Date.now());
      setCode('');
      setCodeErrorText('');
      setStep(2);
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    if (code.length !== 6) return;
    if (remain <= 0) {
      setCodeErrorText('인증 시간이 지났어요. 다시 보내기를 눌러주세요.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/auth/password-reset/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = (await res.json()) as { ok: boolean; ticket?: string; message?: string };
      if (!data.ok || !data.ticket) {
        setCodeErrorText(data.message ?? '인증코드가 올바르지 않아요.');
        return;
      }
      setTicket(data.ticket);
      setStep(3);
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (!(pwLongEnough && pwMatch)) return;
    setPending(true);
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ticket, password: pw1 }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setCodeErrorText(data.message ?? '비밀번호를 바꾸지 못했어요.');
        return;
      }
      setStep(4);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
      <header className="flex flex-shrink-0 items-center gap-2.5 border-b border-primary-soft bg-surface px-5 py-3">
        <Link href="/login" aria-label="뒤로" className="flex h-6 w-6 items-center justify-center">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" aria-hidden>
            <path
              d="M9.5 1.5 1.5 9l8 7.5"
              stroke="#1E3557"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <span className="text-base font-black text-text">비밀번호 찾기</span>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 px-4 pb-7 pt-5">
          {/* 단계 표시 */}
          <div className="flex items-center gap-2.5">
            {STEPS.map((s) => {
              const done = step > s.no;
              const on = step === s.no;
              return (
                <div
                  key={s.no}
                  className={`flex items-center gap-1.5 text-xs font-bold ${
                    on || done ? 'text-primary-strong' : 'text-text/30'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      on
                        ? 'bg-primary text-surface'
                        : done
                          ? 'bg-primary/25 text-primary-strong'
                          : 'bg-primary-soft text-text/30'
                    }`}
                  >
                    {s.no}
                  </span>
                  {s.label}
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <p className="text-xs leading-relaxed text-text/60">
                가입할 때 쓴 학교 이메일을 입력하면
                <br />
                인증코드를 보내드려요.
              </p>
              <Field label="아이디 (학교 이메일)">
                <input
                  className="fld"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(false);
                  }}
                  placeholder="name@eulji.ac.kr"
                />
                {emailError && (
                  <span className="text-xs text-danger">
                    학교 이메일 형식(ac.kr)으로 입력해주세요.
                  </span>
                )}
              </Field>
              <PrimaryButton onClick={sendCode} disabled={email.trim() === '' || pending}>
                인증코드 받기
              </PrimaryButton>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <p className="text-xs leading-relaxed text-text/60">
                <span className="font-bold text-primary-strong">{email}</span> 으로
                <br />
                인증코드를 보냈어요. 5분 안에 입력해주세요.
              </p>
              <Field label="인증코드 6자리">
                <div className="flex items-center gap-1.5">
                  <input
                    className="fld min-w-0 flex-1 tracking-[3px]"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                      setCodeErrorText('');
                    }}
                    placeholder="000000"
                    inputMode="numeric"
                  />
                  <span className="min-w-11 flex-shrink-0 text-right text-xs font-bold text-danger">
                    {mm}:{ss}
                  </span>
                </div>
                {codeErrorText && <span className="text-xs text-danger">{codeErrorText}</span>}
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={pending}
                  className="flex-1 rounded-sm bg-surface px-4 py-3.5 text-md font-bold text-primary-strong ring-1 ring-inset ring-primary-soft disabled:opacity-60"
                >
                  다시 보내기
                </button>
                <PrimaryButton onClick={verify} disabled={code.length !== 6 || pending}>
                  확인
                </PrimaryButton>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <p className="text-xs leading-relaxed text-text/60">
                새로 쓸 비밀번호를 입력해주세요.
                <br />
                8자 이상이어야 해요.
              </p>
              <Field label="새 비밀번호">
                <input
                  className="fld"
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="8자 이상"
                />
              </Field>
              <Field label="새 비밀번호 확인">
                <input
                  className="fld"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="비밀번호를 다시 입력해주세요"
                />
                {pwMessage && (
                  <span
                    className={`text-xs ${
                      pwLongEnough && pwMatch ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {pwMessage}
                  </span>
                )}
              </Field>
              <PrimaryButton onClick={submit} disabled={!(pwLongEnough && pwMatch) || pending}>
                비밀번호 변경
              </PrimaryButton>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <div className="flex h-13 w-13 items-center justify-center rounded-full bg-success/12">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 12.5 9.5 18 20 6"
                    stroke="#188A5E"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="text-base font-bold text-text">비밀번호가 변경됐어요</div>
              <div className="text-xs leading-relaxed text-text/60">
                새 비밀번호로 다시 로그인해주세요.
              </div>
              <Link
                href="/login"
                className="mt-2.5 rounded-sm bg-primary px-5 py-2.5 text-sm font-bold text-surface"
              >
                로그인하러 가기
              </Link>
            </div>
          )}

          {/* 05 P22 · P12 — 메일이 안 오면 문의하기가 아니라 관리자 전화로 */}
          {(step === 1 || step === 2) && (
            <div className="mt-1 rounded-md bg-surface px-4 py-3.5 text-xs leading-relaxed text-text/60 ring-1 ring-inset ring-primary-soft">
              메일이 오지 않으면 스팸함을 확인해주세요.
              <br />
              그래도 받지 못했다면 관리자(031-740-7700)에게 연락주세요.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-text/60">{label}</label>
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-sm bg-primary px-4 py-3.5 text-md font-bold text-surface disabled:bg-primary-soft disabled:text-text/40"
    >
      {children}
    </button>
  );
}
