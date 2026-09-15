'use client';

// F14 · F15 회원가입 폼 — docs/design/회원가입.dc.html 을 그대로 옮겼다.
//
// 프로토타입은 인증번호가 '123456' 으로 박혀 있었지만 여기서는 서버가 만들어
// 메일로 보낸다(08 · 1번 「이미 옮긴 것」):
//   POST /api/auth/signup/send-code   { email }        → { minutes }
//   POST /api/auth/signup/verify-code { email, code }  → { ticket }
//   POST /api/auth/signup             { email, ticket, password, name, gender,
//                                       school, studentId, room, agreed }
// 구글 모드는 이메일 · 비밀번호 없이 /api/auth/google/complete-signup 으로 간다(05 P11).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AGREEMENTS, LEGAL_DOCS, type AgreementKey } from './legal';

type Props = { googleMode: boolean; googleName: string; googleEmail: string };

const CODE_LIMIT_MS = 3 * 60 * 1000; // 회원가입.dc.html 의 값 ([?] 05 에는 없다 — 08 참고)

export function SignupForm({ googleMode, googleName, googleEmail }: Props) {
  const router = useRouter();

  const [name, setName] = useState(googleName);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [gender, setGender] = useState<'여성' | '남성' | null>(null);
  const [school, setSchool] = useState('');
  const [studentId, setStudentId] = useState('');
  const [room, setRoom] = useState('');

  const [pwVisible, setPwVisible] = useState(false);
  const [pw2Visible, setPw2Visible] = useState(false);

  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [codeStatus, setCodeStatus] = useState<'wrong' | null>(null);
  const [codeDeadline, setCodeDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [agree, setAgree] = useState<Record<AgreementKey, boolean>>({
    terms: false,
    privacy: false,
    age14: false,
    marketing: false,
  });

  const [docOpen, setDocOpen] = useState<'terms' | 'privacy' | null>(null);
  const [docAgree, setDocAgree] = useState(false);
  const [docScrolledEnd, setDocScrolledEnd] = useState(false);

  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const idVerified = ticket !== '';
  const emailValid = /^[^\s@]+@[^\s@]+\.ac\.kr$/i.test(userId.trim());
  const expired = codeDeadline !== null && now >= codeDeadline && !idVerified;
  const msLeft = codeDeadline ? Math.max(0, codeDeadline - now) : 0;
  const timerText = `${Math.floor(msLeft / 60000)}:${String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0')}`;

  const pwMismatch = password2.length > 0 && password !== password2;
  const pwMatch = password2.length > 0 && password === password2 && password.length > 0;

  const nameOk = !!name.trim();
  const pwOk = googleMode || (password.length >= 8 && pwMatch);
  const idChecked = googleMode || idVerified;
  const schoolOk = !!school.trim();
  const studentIdOk = !!studentId.trim();
  const roomOk = !!room.trim();
  const requiredOk = AGREEMENTS.filter((a) => a.required).every((a) => agree[a.key]);
  const canSubmit =
    nameOk && idChecked && pwOk && gender && schoolOk && studentIdOk && roomOk && requiredOk;

  const allChecked = AGREEMENTS.every((a) => agree[a.key]);

  let idCheckMessage: string | null = null;
  if (userId.length > 0 && !emailValid) idCheckMessage = '학교 이메일 형식(ac.kr)으로 입력해주세요.';

  let codeMessage: string | null = null;
  let codeMessageOk = false;
  if (idVerified) {
    codeMessage = '이메일 인증이 완료됐어요.';
    codeMessageOk = true;
  } else if (expired) {
    codeMessage = '인증 시간이 만료됐어요. 재발송해주세요.';
  } else if (codeStatus === 'wrong') {
    codeMessage = '인증번호가 일치하지 않아요.';
  }

  async function sendCode() {
    if (!emailValid || pending) return;
    setPending(true);
    try {
      const res = await fetch('/api/auth/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userId.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; devCode?: string };
      if (!data.ok) {
        setToast(data.message ?? '인증번호를 보내지 못했어요.');
        return;
      }
      if (data.devCode) {
        console.log(`%c[Washed 인증코드] >> ${data.devCode} <<`, 'color: #2F63B8; font-size: 16px; font-weight: bold;');
      }
      setCodeSent(true);
      setCode('');
      setCodeStatus(null);
      setCodeDeadline(Date.now() + CODE_LIMIT_MS);
      setToast(`${userId.trim()}로 인증번호를 보냈어요.`);
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    if (expired || idVerified || pending) return;
    setPending(true);
    try {
      const res = await fetch('/api/auth/signup/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userId.trim(), code: code.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; ticket?: string; message?: string };
      if (!data.ok || !data.ticket) {
        setCodeStatus('wrong');
        return;
      }
      setTicket(data.ticket);
      setCodeStatus(null);
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (!canSubmit) {
      setShowErrors(true);
      setToast('필수 항목을 모두 입력·확인해주세요.');
      return;
    }
    setPending(true);
    try {
      const url = googleMode ? '/api/auth/google/complete-signup' : '/api/auth/signup';
      const body = googleMode
        ? { name: name.trim(), gender, school: school.trim(), studentId, room, agreed: true }
        : {
            email: userId.trim(),
            ticket,
            password,
            name: name.trim(),
            gender,
            school: school.trim(),
            studentId,
            room,
            agreed: true,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setToast(data.message ?? '가입에 실패했어요.');
        return;
      }

      if (googleMode) {
        // 05 P11 — 구글 가입은 로그인 화면을 거치지 않고 바로 홈으로 간다.
        setToast('가입이 완료됐어요! 홈으로 이동합니다.');
        setTimeout(() => router.push('/home'), 900);
      } else {
        // 07 흐름표 45줄 — 이메일 가입은 로그인 화면으로 돌아간다.
        setToast('가입이 완료됐어요! 로그인해주세요.');
        setTimeout(() => router.push('/login'), 900);
      }
    } finally {
      setPending(false);
    }
  }

  function toggleAgreement(key: AgreementKey) {
    // 약관 · 개인정보는 본문을 끝까지 읽어야 동의할 수 있다 (05 P11)
    if ((key === 'terms' || key === 'privacy') && !agree[key]) {
      setDocOpen(key);
      setDocAgree(false);
      setDocScrolledEnd(false);
      return;
    }
    setAgree((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll() {
    const next = !allChecked;
    if (next && !agree.terms) {
      setDocOpen('terms');
      return;
    }
    if (next && !agree.privacy) {
      setDocOpen('privacy');
      return;
    }
    setAgree({ terms: next, privacy: next, age14: next, marketing: next });
  }

  const errLine = showErrors;

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 pb-8 pt-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black text-text">회원가입</h1>
          <p className="text-sm font-medium text-text/60">기숙사 세탁실을 편하게 이용해 보세요</p>
        </div>

        <div className="flex flex-col gap-3.5 rounded-xl bg-surface p-4.5">
          <Field label="이름" error={errLine && !nameOk ? '이름을 입력해주세요.' : null}>
            <input
              className="fld"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력해 주세요"
            />
          </Field>

          {/* 구글 모드에서는 아이디 · 인증코드 · 비밀번호 · 비밀번호 확인 네 칸이 숨는다 (05 P11) */}
          {googleMode ? (
            <Field label="아이디 (학교 이메일)">
              <input className="fld opacity-60" value={googleEmail} readOnly />
              <span className="text-xs text-success">구글 계정으로 확인된 이메일이에요.</span>
            </Field>
          ) : (
            <Field
              label="아이디 (학교 이메일)"
              error={errLine && !idChecked ? '이메일 인증을 완료해주세요.' : null}
            >
              <div className="flex gap-1.5">
                <input
                  className="fld min-w-0 flex-1"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setCodeSent(false);
                    setTicket('');
                    setCode('');
                    setCodeStatus(null);
                    setCodeDeadline(null);
                  }}
                  placeholder="name@school.ac.kr"
                />
                <SmallButton onClick={sendCode} disabled={!emailValid || idVerified || pending}>
                  {idVerified ? '인증완료' : codeSent ? '재발송' : '인증하기'}
                </SmallButton>
              </div>
              {idCheckMessage && <span className="text-xs text-danger">{idCheckMessage}</span>}

              {codeSent && (
                <>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div className="relative flex-1">
                      <input
                        className="fld pr-12"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          setCodeStatus(null);
                        }}
                        disabled={idVerified}
                        placeholder="인증번호 6자리"
                        inputMode="numeric"
                      />
                      {!idVerified && (
                        <span
                          className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${
                            expired ? 'text-danger' : 'text-text/50'
                          }`}
                        >
                          {timerText}
                        </span>
                      )}
                    </div>
                    <SmallButton onClick={verifyCode} disabled={idVerified || expired || pending}>
                      {idVerified ? '확인됨' : '확인'}
                    </SmallButton>
                  </div>
                  {codeMessage && (
                    <span className={`text-xs ${codeMessageOk ? 'text-success' : 'text-danger'}`}>
                      {codeMessage}
                    </span>
                  )}
                </>
              )}
            </Field>
          )}

          {!googleMode && (
            <>
              <Field
                label="비밀번호"
                error={errLine && password.length < 8 ? '비밀번호는 8자 이상이어야 해요.' : null}
              >
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  visible={pwVisible}
                  onToggle={() => setPwVisible((v) => !v)}
                  placeholder="8자 이상"
                />
              </Field>

              <Field label="비밀번호 확인">
                <PasswordInput
                  value={password2}
                  onChange={setPassword2}
                  visible={pw2Visible}
                  onToggle={() => setPw2Visible((v) => !v)}
                  placeholder="비밀번호를 다시 입력해 주세요"
                />
                {(pwMismatch || pwMatch) && (
                  <span className={`text-xs ${pwMismatch ? 'text-danger' : 'text-success'}`}>
                    {pwMismatch ? '비밀번호가 일치하지 않아요.' : '비밀번호가 일치해요.'}
                  </span>
                )}
              </Field>
            </>
          )}

          <Field label="성별" error={errLine && !gender ? '성별을 선택해주세요.' : null}>
            <div className="flex gap-1.5">
              {(['여성', '남성'] as const).map((g) => {
                const on = gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 rounded-sm px-3 py-3 text-sm font-bold ring-1 ring-inset ${
                      on
                        ? 'bg-primary/12 text-primary ring-primary'
                        : 'bg-surface text-text ring-primary-soft'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="소속(학교)" error={errLine && !schoolOk ? '소속(학교)을 입력해주세요.' : null}>
            <input
              className="fld"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="학교명을 입력해 주세요"
            />
          </Field>

          <Field label="학번" error={errLine && !studentIdOk ? '학번을 입력해주세요.' : null}>
            <input
              className="fld"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
              placeholder="학번을 입력해 주세요"
              inputMode="numeric"
            />
          </Field>

          <Field label="호실" error={errLine && !roomOk ? '호실을 입력해주세요.' : null}>
            <input
              className="fld"
              value={room}
              onChange={(e) => {
                // 디자인대로 숫자만 받아 "302호" 로 만든다
                const raw = e.target.value;
                const digits =
                  room.endsWith('호') && raw === room.slice(0, -1)
                    ? room.slice(0, -1).replace(/[^0-9]/g, '').slice(0, -1)
                    : raw.replace(/[^0-9]/g, '');
                setRoom(digits ? `${digits}호` : '');
              }}
              placeholder="예: 302호"
              inputMode="numeric"
            />
          </Field>
        </div>

        {/* 약관 동의 */}
        <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-2.5">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 border-b border-primary-soft px-3 py-2.5 text-left"
          >
            <CheckBox on={allChecked} size={18} />
            <span className="text-sm font-bold text-text">전체 동의</span>
          </button>

          {AGREEMENTS.map((a) => (
            <div key={a.key} className="flex items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => toggleAgreement(a.key)} aria-label={a.label}>
                <CheckBox on={agree[a.key]} size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleAgreement(a.key)}
                className="flex-1 text-left text-xs text-text/70"
              >
                {a.label}
              </button>
              {a.link && (
                <button
                  type="button"
                  onClick={() => {
                    setDocOpen(a.key as 'terms' | 'privacy');
                    setDocAgree(false);
                    setDocScrolledEnd(false);
                  }}
                  className="text-xs font-bold text-primary"
                >
                  보기 ›
                </button>
              )}
            </div>
          ))}
        </div>
        {showErrors && !requiredOk && (
          <span className="text-xs text-danger">필수 약관에 모두 동의해주세요.</span>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-4 text-lg font-bold text-surface disabled:opacity-60"
        >
          가입하기
        </button>
      </div>

      {/* 약관 · 개인정보 본문 시트 — 끝까지 읽어야 동의 체크가 눌린다 */}
      {docOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-text/45">
          <div className="flex h-[86%] w-full flex-col overflow-hidden rounded-t-xl bg-surface">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-primary-soft px-4 py-3.5">
              <span className="text-base font-black text-text">{LEGAL_DOCS[docOpen].title}</span>
              <button
                type="button"
                onClick={() => {
                  setDocOpen(null);
                  setDocAgree(false);
                  setDocScrolledEnd(false);
                }}
                className="px-1 text-text/40"
              >
                ×
              </button>
            </div>

            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setDocScrolledEnd(true);
              }}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-5 pt-4"
            >
              {LEGAL_DOCS[docOpen].sections.map((section, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  {section.title && (
                    <span className="text-sm font-black text-text">{section.title}</span>
                  )}
                  {section.paragraphs.map((p, j) => (
                    <span key={j} className="text-xs leading-relaxed text-text/80">
                      {p}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex flex-shrink-0 flex-col gap-3 border-t border-primary-soft px-4 pb-5 pt-3.5">
              {!docScrolledEnd && (
                <span className="text-xs text-text/50">
                  약관 내용을 끝까지 읽어야 동의할 수 있어요.
                </span>
              )}
              <button
                type="button"
                onClick={() => docScrolledEnd && setDocAgree((v) => !v)}
                className="flex items-center gap-2.5"
                disabled={!docScrolledEnd}
              >
                <CheckBox on={docAgree} size={18} />
                <span className="text-xs font-bold text-text">
                  본인은 위의 {LEGAL_DOCS[docOpen].title}에 동의합니다.
                </span>
              </button>
              <button
                type="button"
                disabled={!docAgree || !docScrolledEnd}
                onClick={() => {
                  const key = docOpen;
                  setAgree((prev) => ({ ...prev, [key]: true }));
                  setDocOpen(null);
                  setDocAgree(false);
                  setDocScrolledEnd(false);
                }}
                className="rounded-sm bg-primary px-4 py-3 text-md font-bold text-surface disabled:bg-primary-soft disabled:text-text/30"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center">
          <div className="flex max-w-[88%] items-center gap-2 rounded-full bg-text px-4 py-2.5 text-xs font-medium text-surface">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-text/60">{label}</label>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

function SmallButton({
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
      className="h-10 flex-shrink-0 whitespace-nowrap rounded-sm bg-surface px-3.5 text-xs font-bold text-primary-strong ring-[1.5px] ring-inset ring-primary-soft disabled:bg-primary-soft disabled:text-text/30 disabled:ring-0"
    >
      {children}
    </button>
  );
}

/** 디자인의 눈 모양 아이콘 (회원가입.dc.html 의 _eyeIcon) */
function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        className="fld pr-10"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center p-1 text-text/50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            {!visible && <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="1.8" />}
          </svg>
        </button>
      )}
    </div>
  );
}

/** 디자인의 체크박스 (회원가입.dc.html) */
function CheckBox({ on, size }: { on: boolean; size: number }) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-sm ring-1 ring-inset ${
        on ? 'bg-primary ring-primary' : 'bg-surface ring-primary-soft'
      }`}
      style={{ width: size, height: size, borderRadius: size >= 18 ? 6 : 5 }}
    >
      {on && (
        <svg width={size - 7} height={size - 7} viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.5 6.2l2.3 2.3 4.7-4.7"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
