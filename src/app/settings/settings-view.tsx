'use client';

// 설정 화면 로직 (F11 · F16 · F36) — docs/design/설정.dc.html.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import {
  enablePush,
  permissionServerSnapshot,
  permissionSnapshot,
  subscribePushState,
} from '@/lib/push-client';

import { FAQ } from './faq';

type Props = {
  name: string;
  studentId: string;
  room: string;
  warningCount: number;
  /** 서버에서 세어 넘긴다 — 컴포넌트 안에서 날짜를 다시 세지 않는다 */
  restrictedDaysLeft: number;
  onSignOut: () => Promise<void>;
};

/** 화면 문구 → 06 「신고」의 저장값 (05 P15) */
const REASONS = [
  { label: '기기가 고장났어요', value: '기기 고장' },
  { label: '순서를 지키지 않았어요', value: '순서 미준수' },
  { label: '세탁물이 있어요', value: '세탁물 있음' },
  { label: '기타', value: '기타' },
] as const;

type ReasonValue = (typeof REASONS)[number]['value'];

export function SettingsView({
  name,
  studentId,
  room,
  warningCount,
  restrictedDaysLeft,
  onSignOut,
}: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 05 P26 — 허용 여부는 브라우저가 기억한다. 서버에는 구독이 있는지만 남는다.
  const permission = useSyncExternalStore(
    subscribePushState,
    permissionSnapshot,
    permissionServerSnapshot,
  );

  // 디자인(설정.dc.html)의 알림 토글 둘. 06 이 저장 항목을 만들지 않아(F19 · v2)
  // 프로토타입과 똑같이 **화면 상태로만** 둔다 — 새로 고치면 기본값으로 돌아간다.
  const [tenMin, setTenMin] = useState(true);
  const [ready, setReady] = useState(true);

  const [reason, setReason] = useState<ReasonValue | null>(null);
  const [machineKind, setMachineKind] = useState<'세탁기' | '건조기' | null>(null);
  const [machineNo, setMachineNo] = useState<number | null>(null);
  const [etcText, setEtcText] = useState('');

  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // 05 P15 — 기기 관련 세 사유는 종류 · 호기가 필수, 「기타」는 기기를 고르지 않는다.
  const needsMachine = reason !== null && reason !== '기타';
  // 「세탁물 있음」은 증거 사진이 필수인데 업로드 저장소가 아직 없다 (08 · 7번).
  const blockedByPhoto = reason === '세탁물 있음';
  const canSubmit =
    reason !== null &&
    !blockedByPhoto &&
    (!needsMachine || (machineKind !== null && machineNo !== null)) &&
    !pending;

  async function turnOnPush() {
    setPending(true);
    try {
      const result = await enablePush();
      setToast(
        result === 'granted'
          ? '알림을 켰어요.'
          : '브라우저가 알림을 막고 있어요. 폰의 사이트 설정에서 켜주세요.',
      );
    } catch {
      setToast('알림을 켜지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  async function submitReport() {
    if (!canSubmit || reason === null) return;
    setPending(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          machineKind: needsMachine ? machineKind : null,
          machineNo: needsMachine ? machineNo : null,
          etcContent: reason === '기타' ? etcText : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setToast(data.message ?? '접수하지 못했어요.');
        return;
      }
      setReason(null);
      setMachineKind(null);
      setMachineNo(null);
      setEtcText('');
      setToast('신고가 접수됐어요. 관리자가 확인 후 조치할게요.');
    } catch {
      setToast('네트워크 오류예요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  function notBuiltYet() {
    setToast('아직 준비 중인 화면이에요.');
  }

  async function confirmWithdraw() {
    setPending(true);
    try {
      const res = await fetch('/api/account/withdraw', { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setToast(data.message ?? '탈퇴 신청을 처리하지 못했어요.');
        return;
      }
      setWithdrawOpen(false);
      router.push('/home');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 p-4">
        <h1 className="ml-1 text-xl font-black text-text">설정</h1>

        {/* 프로필 — 디자인대로 프로필 수정으로 가는 행이지만 그 화면은 아직 없다(F20 · v2) */}
        <button
          type="button"
          onClick={notBuiltYet}
          className="flex items-center gap-3.5 rounded-md bg-primary-soft p-4 text-left"
        >
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/40">
            <svg width="56" height="56" viewBox="-7 -5.25 38 38" fill="#fff" aria-hidden>
              <circle cx="12" cy="8.6" r="4.2" />
              <path d="M3.5 22c0-5 3.8-8 8.5-8s8.5 3 8.5 8" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-lg font-bold text-text">{name}</span>
            <span className="truncate text-sm text-text/60">
              {studentId} · {room}
            </span>
          </div>
          <Chevron />
        </button>

        <Group title="알림">
          {/* 디자인의 알림 토글 둘 (F19 는 v2 라 저장되지 않는다 — 화면 상태) */}
          <Cell>
            <div className="flex-1">
              <div className="text-md text-text">차례 10분 전 알림</div>
              <div className="mt-0.5 text-xs text-text/50">내 차례가 다가오면 미리 알려드려요</div>
            </div>
            <Toggle on={tenMin} onToggle={() => setTenMin((v) => !v)} label="차례 10분 전 알림" />
          </Cell>
          <Cell>
            <div className="flex-1">
              <div className="text-md text-text">이용 가능 알림</div>
              <div className="mt-0.5 text-xs text-text/50">기기를 바로 이용할 수 있을 때 알려드려요</div>
            </div>
            <Toggle on={ready} onToggle={() => setReady((v) => !v)} label="이용 가능 알림" />
          </Cell>

          {permission === 'granted' ? (
            <Cell>
              <div className="flex-1">
                <div className="text-md text-text">알림을 받고 있어요</div>
                <div className="mt-0.5 text-xs text-text/50">
                  배정 · 종료 · 경고를 폰 알림으로 보내드려요
                </div>
              </div>
            </Cell>
          ) : (
            <Cell>
              <div className="flex-1">
                <div className="text-md text-text">알림이 꺼져 있어요</div>
                <div className="mt-0.5 text-xs text-text/50">
                  {permission === 'unsupported'
                    ? '이 브라우저는 폰 알림을 지원하지 않아요'
                    : '알림을 꺼도 경고는 그대로 쌓여요'}
                </div>
              </div>
              {permission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={turnOnPush}
                  disabled={pending}
                  className="flex-shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-surface disabled:opacity-60"
                >
                  켜기
                </button>
              )}
            </Cell>
          )}

          <Cell>
            <div className="flex-1">
              <div className="text-md text-text">경고 현황</div>
              <div className="mt-0.5 text-xs text-text/50">
                {restrictedDaysLeft > 0
                  ? `이용 제한 중 · ${restrictedDaysLeft}일 남음`
                  : '누적 3회가 되면 3일 동안 줄서기를 할 수 없어요'}
              </div>
            </div>
            <span
              className={`flex-shrink-0 text-md font-bold ${
                warningCount >= 3 ? 'text-danger' : 'text-text/60'
              }`}
            >
              {warningCount} / 3
            </span>
          </Cell>
        </Group>

        {/* F11 신고하기 (05 P15) */}
        <div>
          <GroupHead>신고하기</GroupHead>
          <div className="flex flex-col gap-3 rounded-md bg-surface p-4 ring-1 ring-inset ring-primary-soft">
            <span className="text-xs text-text/60">어떤 문제가 있었는지 알려주세요.</span>

            <div className="flex flex-col gap-2">
              {REASONS.map((r) => {
                const on = reason === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setReason(r.value);
                      setMachineKind(null);
                      setMachineNo(null);
                    }}
                    className={`flex items-center gap-2.5 rounded-sm px-3.5 py-3 text-left ring-1 ring-inset ${
                      on ? 'bg-primary/10 ring-primary' : 'bg-surface ring-primary-soft'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 flex-shrink-0 rounded-full ring-inset ${
                        on ? 'bg-primary ring-1 ring-primary' : 'ring-[1.5px] ring-text/20'
                      }`}
                    />
                    <span
                      className={`text-md font-medium ${on ? 'text-primary-strong' : 'text-text/70'}`}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}

              {needsMachine && (
                <div className="flex flex-col gap-2 rounded-sm bg-bg p-3 ring-1 ring-inset ring-primary-soft">
                  <span className="text-xs font-bold text-text/60">기기 종류</span>
                  <div className="flex gap-1.5">
                    {(['세탁기', '건조기'] as const).map((kind) => {
                      const on = machineKind === kind;
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => {
                            setMachineKind(kind);
                            setMachineNo(null);
                          }}
                          className={`flex-1 rounded-sm px-2 py-2 text-xs font-bold ring-1 ring-inset ${
                            on
                              ? 'bg-primary text-surface ring-primary'
                              : 'bg-surface text-text/70 ring-primary-soft'
                          }`}
                        >
                          {kind}
                        </button>
                      );
                    })}
                  </div>

                  {machineKind && (
                    <>
                      <span className="mt-1 text-xs font-bold text-text/60">호기 선택</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: machineKind === '건조기' ? 4 : 8 }, (_, i) => i + 1).map(
                          (n) => {
                            const on = machineNo === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setMachineNo(n)}
                                className={`rounded-sm px-1 py-2 text-xs font-bold ring-1 ring-inset ${
                                  on
                                    ? 'bg-primary text-surface ring-primary'
                                    : 'bg-surface text-text/70 ring-primary-soft'
                                }`}
                              >
                                {n}호기
                              </button>
                            );
                          },
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {reason === '기타' && (
                <textarea
                  value={etcText}
                  onChange={(e) => setEtcText(e.target.value)}
                  placeholder="의견을 입력해주세요"
                  className="min-h-16 resize-none rounded-sm bg-bg p-3 text-sm text-text outline-none ring-1 ring-inset ring-primary-soft"
                />
              )}

              {blockedByPhoto && (
                <div className="flex flex-col gap-1 rounded-sm bg-bg p-3 ring-1 ring-inset ring-primary-soft">
                  <span className="text-xs font-bold text-text/60">증거 사진 (필수)</span>
                  <span className="text-xs leading-tight text-danger">
                    사진 업로드는 아직 준비 중이에요. 이 사유는 사진이 있어야만 접수할 수 있어
                    (05 P15) 지금은 접수되지 않아요 — 관리자(031-740-7700)에게 연락해주세요.
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={submitReport}
              disabled={!canSubmit}
              className="rounded-sm bg-danger px-4 py-3 text-md font-bold text-surface disabled:bg-primary-soft disabled:text-text/40"
            >
              신고 접수
            </button>
          </div>
        </div>

        {/* F37 언어 (05 P25) — <lang-picker> 는 public/i18n.js 가 정의한다 */}
        <div>
          <GroupHead>언어</GroupHead>
          <div className="relative z-5 rounded-md bg-surface ring-1 ring-inset ring-primary-soft">
            <Cell>
              <span className="flex-1 text-md text-text">언어 설정</span>
              <lang-picker variant="compact" align="right" />
            </Cell>
          </div>
        </div>

        <Group title="도움말">
          <button type="button" onClick={() => setFaqOpen(true)} className="w-full">
            <Cell>
              <span className="flex-1 text-left text-md text-text">FAQ</span>
              <Chevron />
            </Cell>
          </button>
          {/* 디자인에 있는 행이다. 문의하기 화면은 아직 없다(F21 · v2) */}
          <button type="button" onClick={notBuiltYet} className="w-full">
            <Cell>
              <span className="flex-1 text-left text-md text-text">문의하기</span>
              <Chevron />
            </Cell>
          </button>
        </Group>

        <Group title="정보">
          <Cell>
            <span className="flex-1 text-md text-text">버전 정보</span>
            <span className="flex-shrink-0 text-md text-text/40">v1.0.0</span>
          </Cell>
        </Group>

        <div className="overflow-hidden rounded-md bg-surface ring-1 ring-inset ring-primary-soft">
          <form action={onSignOut}>
            <button
              type="submit"
              className="w-full border-b border-primary-soft px-4 py-3.5 text-md font-bold text-primary-strong"
            >
              로그아웃
            </button>
          </form>
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="w-full px-4 py-3.5 text-md font-bold text-danger"
          >
            회원탈퇴
          </button>
        </div>

        <div className="text-center text-xs text-text/40">Washed · 버전 1.0.0</div>
      </div>

      {/* F36 탈퇴 확인 (05 P24) */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-text/40 p-10">
          <div className="flex w-full max-w-[300px] flex-col items-center gap-2 overflow-hidden rounded-lg bg-surface pt-5 text-center">
            <span className="text-base font-bold text-text">탈퇴하시겠습니까?</span>
            <span className="px-5 pb-4 text-sm leading-tight text-text/60">
              탈퇴 후 <b className="text-primary-strong">14일</b> 안에 다시 로그인하면 되돌릴 수
              있어요. 14일이 지나면 이용 내역 · 경고 · 신고 기록이 모두 영구 삭제됩니다.
            </span>
            <div className="flex w-full border-t border-primary-soft">
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                className="flex-1 py-3.5 text-base font-medium text-primary-strong"
              >
                취소
              </button>
              <div className="w-px bg-primary-soft" />
              <button
                type="button"
                onClick={confirmWithdraw}
                disabled={pending}
                className="flex-1 py-3.5 text-base font-bold text-danger disabled:opacity-60"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F16 FAQ 시트 — 07 이 "같은 화면에서 올라오는 시트" 로 못박아 두었다 */}
      {faqOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-text/45">
          <div className="flex h-[86%] w-full flex-col overflow-hidden rounded-t-xl bg-surface">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-primary-soft px-4 py-3.5">
              <span className="text-base font-black text-text">자주 묻는 질문</span>
              <button type="button" onClick={() => setFaqOpen(false)} className="px-1.5 text-text/40">
                ×
              </button>
            </div>
            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 pb-6">
              {FAQ.map((section) => (
                <div key={section.title}>
                  <GroupHead>{section.title}</GroupHead>
                  <div className="overflow-hidden rounded-md bg-surface ring-1 ring-inset ring-primary-soft">
                    {section.items.map((item, index) => {
                      const open = openFaqId === item.id;
                      return (
                        <div key={item.id} className={index > 0 ? 'border-t border-primary-soft' : ''}>
                          <button
                            type="button"
                            onClick={() => setOpenFaqId(open ? null : item.id)}
                            className="flex w-full items-start gap-2.5 px-4 py-3.5 text-left"
                          >
                            <span className="flex-shrink-0 text-sm font-black leading-tight text-primary">
                              Q
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-bold leading-tight text-text">
                              {item.question}
                            </span>
                            <svg
                              width="12"
                              height="8"
                              viewBox="0 0 12 8"
                              fill="none"
                              aria-hidden
                              className="mt-1.5 flex-shrink-0 transition-transform"
                              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                              <path
                                d="M1.2 1.6 6 6.2l4.8-4.6"
                                stroke="#B4C2D6"
                                strokeWidth="1.9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          {open && (
                            <div className="whitespace-pre-line px-4 pb-4 pl-9 text-sm leading-relaxed text-text/70">
                              {item.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center">
          <div className="flex max-w-[88%] items-center gap-2 rounded-full bg-text px-4 py-2 text-xs font-medium text-surface">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 디자인의 행 끝 화살표 (설정.dc.html) */
function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden className="flex-shrink-0">
      <path
        d="M1.2 1.2 6.6 7l-5.4 5.8"
        stroke="#B4C2D6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 디자인의 알림 토글 (설정.dc.html 의 notifSettings) */
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${
        on ? 'bg-primary' : 'bg-primary-soft'
      }`}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-all"
        style={{ left: on ? '18px' : '2px' }}
      />
    </button>
  );
}

function GroupHead({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 ml-4 text-xs font-medium text-text/50">{children}</div>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <GroupHead>{title}</GroupHead>
      <div className="overflow-hidden rounded-md bg-surface ring-1 ring-inset ring-primary-soft">
        {children}
      </div>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-primary-soft px-4 py-2.5 last:border-b-0">
      {children}
    </div>
  );
}
