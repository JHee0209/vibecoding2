'use client';

// F1 · F3~F10 화면 로직 — docs/design/홈.dc.html 을 서버 데이터에 맞춰 옮겼다.
//
// 서버가 상태의 유일한 기준이다(src/lib/queue.ts). 이 컴포넌트는 5초마다
// router.refresh() 로 서버 데이터를 다시 받아오고(08-deployNOTE.md 4번 "짧은
// 폴링"), 그 사이 카운트다운 숫자만 1초 타이머로 화면에서 미리 계산해 보여준다 —
// 실제 만료 · 배정 판정은 항상 서버(reconcile)가 내린다.
//
// 레이아웃은 홈.dc.html 과 같은 구조다 — 위쪽 바 · 가운데 스크롤 영역 · 아래쪽
// 탭 셋 다 flex-shrink:0 / flex:1 로 나뉘어야 탭이 스크롤에 딸려 올라가지 않는다.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import type { HomeMachine, HomeTypeSummary, MachineKind } from '@/lib/queue';

type Props = {
  userName: string;
  machines: HomeMachine[];
  typeSummaries: HomeTypeSummary[];
};

type Filter = '전체' | MachineKind;

const REFRESH_MS = 5000;

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function machineIcon(machine: { kind: MachineKind; status: string }): string {
  const prefix = machine.kind === '세탁기' ? 'washer' : 'dryer';
  const state = machine.status === '사용중' ? 'inuse' : 'available';
  return `/icons/${prefix}-${state}.svg`;
}

export function HomeView({ userName, machines, typeSummaries }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('전체');
  // 종류별로 따로 잠근다 — 세탁기 버튼을 누르는 동안 건조기 버튼까지 함께
  // 잠기면(예전 버그) 하나만 눌렀는데 둘 다 반응한 것처럼 보인다.
  const [pendingKind, setPendingKind] = useState<MachineKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [qr, setQr] = useState<{ kind: MachineKind; stage: 'confirm' | 'scanning' } | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function call(kind: MachineKind, input: RequestInfo, init: RequestInit) {
    setPendingKind(kind);
    try {
      const res = await fetch(input, init);
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setToast(data.message ?? '처리하지 못했어요.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setToast('네트워크 오류예요. 잠시 뒤 다시 시도해주세요.');
      return false;
    } finally {
      setPendingKind(null);
    }
  }

  async function join(kind: MachineKind) {
    const ok = await call(kind, '/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    if (ok) setToast(`${kind} 줄서기를 시작했어요.`);
  }

  async function leave(kind: MachineKind) {
    const ok = await call(kind, '/api/queue', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    if (ok) setToast(`${kind} 대기열에서 나갔어요.`);
  }

  async function confirmScan() {
    if (!qr) return;
    const { kind } = qr;
    setQr(null);
    const ok = await call(kind, '/api/queue/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    if (ok) setToast('QR 인증 완료! 타이머가 시작됐어요.');
  }

  async function finish(kind: MachineKind) {
    const ok = await call(kind, '/api/queue/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    if (ok) setToast('이용을 완료했어요. 다음 분이 이용할 수 있어요.');
  }

  const waitingKinds = typeSummaries.filter((t) => t.myQueue?.status === '대기 중');
  const activeKinds = typeSummaries.filter(
    (t) => t.myQueue && t.myQueue.status !== '대기 중',
  );
  const fullyIdle = waitingKinds.length === 0 && activeKinds.length === 0;

  const visibleMachines = machines.filter((m) => filter === '전체' || m.kind === filter);
  const washers = visibleMachines.filter((m) => m.kind === '세탁기');
  const dryers = visibleMachines.filter((m) => m.kind === '건조기');

  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-black text-text">안녕하세요, {userName}</h1>
            <p className="text-sm text-text/60">오늘도 줄 서지 않고 편하게 세탁해요</p>
          </div>

          {fullyIdle ? (
            <div className="rounded-lg bg-surface p-4">
              <span className="text-sm text-text/60">아무것도 사용하지 않고 있습니다</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
                <span className="text-sm font-bold text-primary">내 대기 현황</span>
                {waitingKinds.length === 0 ? (
                  <span className="text-xs text-text/60">대기 중인 기기가 없어요</span>
                ) : (
                  waitingKinds.map((t) => (
                    <div key={t.kind} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Image
                          src={`/icons/${t.kind === '세탁기' ? 'washer' : 'dryer'}-inuse.svg`}
                          alt=""
                          width={24}
                          height={24}
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{t.kind}</span>
                          <span className="text-xs font-bold text-primary">
                            {t.aheadCount > 0 ? `내 앞에 ${t.aheadCount}명` : '곧 배정돼요'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-text/60">
                        이용 예정이 아니면 줄 빠지기를 눌러주세요.
                      </span>
                      <button
                        type="button"
                        disabled={pendingKind === t.kind}
                        onClick={() => leave(t.kind)}
                        className="rounded-sm px-2 py-2 text-xs font-bold text-danger ring-1 ring-inset ring-danger/40 disabled:opacity-60"
                      >
                        줄 빠지기
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
                <span className="text-sm font-bold text-primary">현재 상태</span>
                {activeKinds.length === 0 ? (
                  <span className="text-xs text-text/60">이용 중인 기기가 없어요</span>
                ) : (
                  activeKinds.map((t) => {
                    const q = t.myQueue!;
                    const machine = machines.find((m) => m.machine_id === q.machine_id);
                    const icon = `/icons/${t.kind === '세탁기' ? 'washer' : 'dryer'}-inuse.svg`;

                    if (q.status === '배정') {
                      const left = q.assign_deadline_at
                        ? new Date(q.assign_deadline_at).getTime() - now
                        : 0;
                      return (
                        <div key={t.kind} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Image src={icon} alt="" width={24} height={24} />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{machine?.name}</span>
                              <span className="text-xs font-bold text-primary">{fmt(left)} 남음</span>
                            </div>
                          </div>
                          <span className="text-xs text-text/60">
                            10분이 지나면 다음 대기자에게 순서가 넘어가므로 시간 내에 QR 인증해
                            주세요.
                          </span>
                          <button
                            type="button"
                            disabled={pendingKind === t.kind}
                            onClick={() => setQr({ kind: t.kind, stage: 'confirm' })}
                            className="rounded-sm bg-primary px-2 py-2 text-xs font-bold text-surface disabled:opacity-60"
                          >
                            QR 인증
                          </button>
                        </div>
                      );
                    }
                    if (q.status === '사용중') {
                      const left = machine?.ends_at
                        ? new Date(machine.ends_at).getTime() - now
                        : 0;
                      return (
                        <div key={t.kind} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Image src={icon} alt="" width={24} height={24} />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{machine?.name}</span>
                              <span className="text-xs font-bold text-primary">
                                약 {fmt(left)} 남음
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-text/60">
                            빨리 끝나면 다음 사람을 위해 &quot;다했어요&quot;를 눌러주세요.
                          </span>
                          <button
                            type="button"
                            disabled={pendingKind === t.kind}
                            onClick={() => finish(t.kind)}
                            className="rounded-sm px-2 py-2 text-xs font-bold text-danger ring-1 ring-inset ring-danger/40 disabled:opacity-60"
                          >
                            다했어요
                          </button>
                        </div>
                      );
                    }
                    // 수거대기
                    const left = q.pickup_deadline_at
                      ? new Date(q.pickup_deadline_at).getTime() - now
                      : 0;
                    return (
                      <div key={t.kind} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Image src={icon} alt="" width={24} height={24} />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{machine?.name}</span>
                            <span className="text-xs font-bold text-danger">{fmt(left)} 남음</span>
                          </div>
                        </div>
                        <span className="text-xs text-danger">
                          시간이 끝났어요! 지금 누르지 않으면 경고가 쌓여요.
                        </span>
                        <button
                          type="button"
                          disabled={pendingKind === t.kind}
                          onClick={() => finish(t.kind)}
                          className="rounded-sm px-2 py-2 text-xs font-bold text-danger ring-1 ring-inset ring-danger/40 disabled:opacity-60"
                        >
                          다했어요
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <h2 className="text-base font-black text-text">실시간 대기 현황</h2>
            <p className="text-xs text-text/60">차례 10분 전, 이용 가능해질 때 알려드려요</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {typeSummaries.map((t) => {
              const availablePct = (t.available / t.total) * 100;
              const inusePct = 100 - availablePct;
              const barColor = t.kind === '세탁기' ? 'bg-primary' : 'bg-warning';

              let actionLabel: string | null = null;
              let info = '';
              let disabled = false;
              let onClick = () => {};

              if (t.restricted) {
                disabled = true;
                info = '경고 누적으로 이용이 제한돼요';
              } else if (t.myQueue?.status && t.myQueue.status !== '대기 중') {
                info = `${machines.find((m) => m.machine_id === t.myQueue!.machine_id)?.name ?? t.kind} 이용 중`;
              } else if (t.myQueue?.status === '대기 중') {
                disabled = true;
                info = t.aheadCount > 0 ? `내 앞에 ${t.aheadCount}명 대기 중이에요` : '곧 배정돼요';
              } else {
                actionLabel = '줄서기';
                onClick = () => join(t.kind);
                info = t.available > 0 ? '바로 배정돼요' : `현재 ${t.waiting}명 대기 중이에요`;
              }

              return (
                <div key={t.kind} className="flex flex-col gap-2 rounded-lg bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{t.kind}</span>
                    <span className="text-xs text-text/60">전체 {t.total}대</span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full">
                    <div className={barColor} style={{ width: `${inusePct}%` }} />
                    <div className="bg-primary-soft" style={{ width: `${availablePct}%` }} />
                  </div>
                  <div className="flex gap-3 text-xs text-text/60">
                    <span>
                      <span className="font-bold">{t.inuse}</span> 사용중
                    </span>
                    <span>
                      <span className="font-bold">{t.available}</span> 가능
                    </span>
                  </div>
                  <span className="text-[10px] text-primary">{info}</span>
                  {actionLabel && (
                    <button
                      type="button"
                      disabled={disabled || pendingKind === t.kind}
                      onClick={onClick}
                      className="w-full rounded-sm bg-primary px-2 py-2 text-xs font-bold text-surface disabled:bg-primary-soft disabled:text-text/40"
                    >
                      {actionLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">기기 목록</span>
              <div className="flex gap-1 rounded-full bg-primary-soft p-1">
                {(['전체', '세탁기', '건조기'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      filter === f ? 'bg-surface text-text' : 'text-text/50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {washers.length > 0 && <MachineGroup label="세탁기" machines={washers} now={now} />}
            {washers.length > 0 && dryers.length > 0 && <div className="h-px bg-primary-soft" />}
            {dryers.length > 0 && <MachineGroup label="건조기" machines={dryers} now={now} />}
          </div>
        </div>
      </div>

      {qr?.stage === 'confirm' && (
        <Modal>
          <div className="flex flex-col gap-1">
            <span className="text-base font-black">QR 인증 안내</span>
            <span className="text-xs text-text/60">
              QR을 찍으면 바로 타이머가 시작돼요. 세탁물을 넣은 뒤 기기에 붙은 QR을 찍어주세요.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQr(null)}
              className="rounded-sm px-4 py-2 text-xs font-bold text-text ring-1 ring-inset ring-primary-soft"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => setQr((s) => (s ? { ...s, stage: 'scanning' } : s))}
              className="rounded-sm bg-primary px-4 py-2 text-xs font-bold text-surface"
            >
              확인
            </button>
          </div>
        </Modal>
      )}

      {qr?.stage === 'scanning' && (
        <Modal dark>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-surface">QR 스캔</span>
            <button type="button" onClick={() => setQr(null)} className="text-surface/60">
              ×
            </button>
          </div>
          <div className="aspect-square rounded-lg bg-text" />
          <span className="text-center text-xs text-surface/70">
            QR 코드를 사각형 안에 맞춰주세요.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setQr(null)}
              className="flex-1 rounded-sm px-2 py-2 text-xs font-bold text-surface ring-1 ring-inset ring-surface/30"
            >
              취소
            </button>
            <button
              type="button"
              disabled={pendingKind === qr.kind}
              onClick={confirmScan}
              className="flex-1 rounded-sm bg-primary px-2 py-2 text-xs font-bold text-surface disabled:opacity-60"
            >
              인식 완료
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-text px-4 py-2 text-xs font-medium text-surface shadow-lg">
            <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}

function Modal({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-text/40 p-5">
      <div
        className={`flex w-full max-w-[300px] flex-col gap-4 rounded-lg p-5 ${
          dark ? 'bg-text' : 'bg-surface'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function MachineGroup({
  label,
  machines,
  now,
}: {
  label: string;
  machines: HomeMachine[];
  now: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold text-text/50">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {machines.map((m) => (
          <MachineCard key={m.machine_id} machine={m} now={now} />
        ))}
      </div>
    </div>
  );
}

function MachineCard({ machine, now }: { machine: HomeMachine; now: number }) {
  const isFault = machine.status === '고장';
  const badge = isFault
    ? { dot: 'bg-danger', fg: 'text-danger', label: '고장' }
    : machine.status === '사용중'
      ? { dot: 'bg-primary', fg: 'text-primary-strong', label: '사용중' }
      : { dot: 'bg-primary-soft', fg: 'text-text/60', label: '사용가능' };

  let progressPct: number | null = null;
  if (machine.mine && machine.status === '사용중' && machine.ends_at) {
    const total = machine.kind === '세탁기' ? 60 * 60 * 1000 : 45 * 60 * 1000;
    const left = new Date(machine.ends_at).getTime() - now;
    progressPct = Math.min(100, Math.max(4, 100 - (left / total) * 100));
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-surface p-2.5">
      <div className="relative h-6 w-6">
        <Image
          src={machineIcon(machine)}
          alt=""
          fill
          sizes="24px"
          className={isFault ? 'opacity-55 grayscale' : ''}
        />
        {isFault && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-[9px] font-black leading-none text-surface">
            !
          </span>
        )}
      </div>
      <span className="truncate text-[11px] font-bold">{machine.name}</span>
      <div className="flex items-center gap-1">
        <span className={`h-1 w-1 rounded-full ${badge.dot}`} />
        <span className={`text-[9.5px] font-medium ${badge.fg}`}>{badge.label}</span>
      </div>
      {progressPct !== null && (
        <div className="h-1 overflow-hidden rounded-full bg-primary-soft">
          <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}
