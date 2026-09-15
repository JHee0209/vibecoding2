'use client';

// F22~F33 관리자 콘솔 뷰 — docs/design/관리자.dc.html 디자인을 100% 그대로 옮겼다.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type TabKey =
  | 'dashboard'
  | 'queue'
  | 'reports'
  | 'history'
  | 'warnings'
  | 'notice'
  | 'users';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: '실시간 기기 현황' },
  { key: 'queue', label: '실시간 대기열 현황' },
  { key: 'reports', label: '신고 내역' },
  { key: 'history', label: '이용 내역' },
  { key: 'warnings', label: '경고 누적 사용자' },
  { key: 'notice', label: '공지사항' },
  { key: 'users', label: '사용자 목록' },
];

interface MachineItem {
  id: string;
  type: 'washer' | 'dryer';
  name: string;
  status: 'available' | 'inuse' | 'fault';
  remaining?: number;
}

const INITIAL_MACHINES: MachineItem[] = [
  { id: 'w1', type: 'washer', name: '세탁기 1호기', status: 'inuse', remaining: 8 },
  { id: 'w2', type: 'washer', name: '세탁기 2호기', status: 'inuse', remaining: 18 },
  { id: 'w3', type: 'washer', name: '세탁기 3호기', status: 'inuse', remaining: 22 },
  { id: 'w4', type: 'washer', name: '세탁기 4호기', status: 'inuse', remaining: 5 },
  { id: 'w5', type: 'washer', name: '세탁기 5호기', status: 'inuse', remaining: 27 },
  { id: 'w6', type: 'washer', name: '세탁기 6호기', status: 'inuse', remaining: 12 },
  { id: 'w7', type: 'washer', name: '세탁기 7호기', status: 'inuse', remaining: 40 },
  { id: 'w8', type: 'washer', name: '세탁기 8호기', status: 'inuse', remaining: 30 },
  { id: 'd1', type: 'dryer', name: '건조기 1호기', status: 'available' },
  { id: 'd2', type: 'dryer', name: '건조기 2호기', status: 'available' },
  { id: 'd3', type: 'dryer', name: '건조기 3호기', status: 'available' },
  { id: 'd4', type: 'dryer', name: '건조기 4호기', status: 'available' },
];

export function AdminView() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('dashboard');

  // 점검 모드 상태
  const [maintenanceOn, setMaintenanceOn] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('washed_maintenance') === '1';
    } catch {
      return false;
    }
  });

  // 기기 관리 상태
  const [machines, setMachines] = useState<MachineItem[]>(INITIAL_MACHINES);
  const [faults, setFaults] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('washed_admin_faults') || '{}');
    } catch {
      return {};
    }
  });
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineType, setNewMachineType] = useState<'washer' | 'dryer'>('washer');
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [confirmRemoveTarget, setConfirmRemoveTarget] = useState<MachineItem | null>(null);

  // 신고 내역 상태
  const [reportFilter, setReportFilter] = useState('전체');
  const [reportsStatus, setReportsStatus] = useState<Record<string, string>>({});

  // 경고 관리 상태
  const [warnMonth, setWarnMonth] = useState('2026.09');
  const [warnOpen, setWarnOpen] = useState<Record<string, boolean>>({});

  // 공지사항 상태
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);
  const [confirmNoticeDelete, setConfirmNoticeDelete] = useState<{ title: string; body: string; date: string } | null>(null);
  const [notices, setNotices] = useState(() => {
    const defaultNotices = [
      {
        title: '9월 정기 점검 안내',
        body: '여자 기숙사 세탁실은 9/11(금) 오전 9시~11시 점검으로 이용이 제한됩니다.',
        date: '2026.09.09',
      },
    ];
    if (typeof window === 'undefined') return defaultNotices;
    try {
      const saved = JSON.parse(localStorage.getItem('washed_notices') || '[]');
      return saved.length > 0 ? saved : defaultNotices;
    } catch {
      return defaultNotices;
    }
  });

  // 사용자 목록 상태
  const [userSearch, setUserSearch] = useState('');
  const [userRoomFilter, setUserRoomFilter] = useState('전체');
  const [userWarnings, setUserWarnings] = useState<Record<string, { count: number; suspendedUntil: number | null }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('washed_warnings') || '{}');
    } catch {
      return {};
    }
  });

  // 이용 내역 상태
  const [historyMachine, setHistoryMachine] = useState('전체');
  const [historyMonth, setHistoryMonth] = useState('전체');

  function toggleMaintenance() {
    const next = !maintenanceOn;
    setMaintenanceOn(next);
    try {
      localStorage.setItem('washed_maintenance', next ? '1' : '0');
    } catch {}
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  // 기기 관련 핸들러
  function toggleFault(id: string) {
    const next = !(faults[id] !== undefined ? faults[id] : machines.find((m) => m.id === id)?.status === 'fault');
    const updated = { ...faults, [id]: next };
    setFaults(updated);
    try {
      localStorage.setItem('washed_admin_faults', JSON.stringify(updated));
    } catch {}
  }

  function forceReset(id: string) {
    const updated = { ...faults, [id]: false };
    setFaults(updated);
    setMachines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'available', remaining: undefined } : m)),
    );
    try {
      localStorage.setItem('washed_admin_faults', JSON.stringify(updated));
    } catch {}
  }

  function confirmRemoveMachine() {
    if (!confirmRemoveTarget) return;
    setMachines((prev) => prev.filter((m) => m.id !== confirmRemoveTarget.id));
    setConfirmRemoveTarget(null);
  }

  function handleAddMachine() {
    if (!newMachineName.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newM: MachineItem = {
      id: newId,
      type: newMachineType,
      name: newMachineName.trim(),
      status: 'available',
    };
    setMachines((prev) => [...prev, newM]);
    setNewMachineName('');
    setConfirmAddOpen(false);
  }

  // 사용자 경고 증감 핸들러
  function adjustWarning(userKey: string, delta: number) {
    const current = userWarnings[userKey] || { count: 0, suspendedUntil: null };
    const nextCount = Math.max(0, current.count + delta);
    const suspendedUntil = nextCount >= 3 ? Date.now() + 3 * 86400000 : null;
    const updated = { ...userWarnings, [userKey]: { count: nextCount, suspendedUntil } };
    setUserWarnings(updated);
    try {
      localStorage.setItem('washed_warnings', JSON.stringify(updated));
    } catch {}
  }

  // 공지사항 등록 핸들러
  function handlePostNotice() {
    if (!noticeTitle.trim()) return;
    const d = new Date();
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const updated = [{ title: noticeTitle.trim(), body: noticeBody.trim(), date: dateStr }, ...notices];
    setNotices(updated);
    setNoticeTitle('');
    setNoticeBody('');
    setConfirmPostOpen(false);
    try {
      localStorage.setItem('washed_notices', JSON.stringify(updated));
    } catch {}
  }

  function handleDeleteNotice() {
    if (!confirmNoticeDelete) return;
    const updated = notices.filter((n) => n !== confirmNoticeDelete);
    setNotices(updated);
    setConfirmNoticeDelete(null);
    try {
      localStorage.setItem('washed_notices', JSON.stringify(updated));
    } catch {}
  }

  // 요약 통계 계산
  const washerTotal = machines.filter((m) => m.type === 'washer').length;
  const dryerTotal = machines.filter((m) => m.type === 'dryer').length;
  const washerInUse = machines.filter(
    (m) => m.type === 'washer' && m.status === 'inuse' && !faults[m.id],
  ).length;
  const dryerInUse = machines.filter(
    (m) => m.type === 'dryer' && m.status === 'inuse' && !faults[m.id],
  ).length;
  const faultCount = machines.filter((m) => faults[m.id] || m.status === 'fault').length;

  // 사용자 더미 데이터
  const userDefs = [
    { name: '원병찬', school: '을지대', studentId: '20231234', room: '302호', baseWarn: 0 },
    { name: '정주희', school: '을지대', studentId: '20230210', room: '210호', baseWarn: 0 },
    { name: '이태연', school: '을지대', studentId: '20224120', room: '412호', baseWarn: 2 },
    { name: '이서연', school: '을지대', studentId: '20221080', room: '108호', baseWarn: 1 },
    { name: '서수영', school: '을지대', studentId: '20220915', room: '115호', baseWarn: 0 },
    { name: '조성원', school: '을지대', studentId: '20220630', room: '306호', baseWarn: 2 },
  ];

  const filteredUsers = userDefs.filter((u) => {
    const matchRoom = userRoomFilter === '전체' || u.room === userRoomFilter;
    const matchQuery = !userSearch.trim() || u.name.includes(userSearch.trim());
    return matchRoom && matchQuery;
  });

  // 신고 더미 데이터
  const reportDefs = [
    { id: 'r1', reason: '기기가 고장났어요', datetime: '09/09 14:20', reporter: '병찬 · 302호', detail: '세탁기 3호기 탈수 중 멈춤' },
    { id: 'r2', reason: '순서를 지키지 않았어요', datetime: '09/08 21:03', reporter: '정주희 · 210호', detail: '배정 차례 무시' },
    { id: 'r3', reason: '세탁물이 있어요', datetime: '09/06 18:40', reporter: '서수영 · 115호', detail: '세탁물 방치 40분 경과' },
    { id: 'r4', reason: '기타', datetime: '09/05 10:15', reporter: '조성원 · 306호', detail: '세제 투입구 오염' },
    { id: 'r5', reason: '기기가 고장났어요', datetime: '09/07 16:45', reporter: '이태연 · 412호', detail: '건조기 2호기 문 열림 감지 불량' },
  ];

  const filteredReports = reportFilter === '전체'
    ? reportDefs
    : reportDefs.filter((r) => (reportsStatus[r.id] || '접수됨') === reportFilter);

  return (
    <div className="flex min-h-screen bg-[#F3F6FB] text-[#171719] font-['Pretendard']">
      {/* 좌측 사이드바 (260px) */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col gap-1 border-r border-[#70737C]/15 bg-white p-4">
        {/* 관리자 로고 */}
        <div className="flex items-center gap-2 p-[8px_10px_16px]">
          <img
            src="/icons/logo-mark.png"
            alt="Washed"
            className="h-[34px] w-[34px] object-contain"
          />
          <div className="whitespace-nowrap text-[15px] font-extrabold text-[#2F63B8]">
            Washed <span className="text-[#171719]">관리자</span>
          </div>
        </div>

        {/* 7개 네비게이션 탭 */}
        <nav className="flex flex-1 flex-col gap-1.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`cursor-pointer rounded-[10px] p-[10px_12px] text-left text-[16px] font-semibold transition-colors whitespace-nowrap ${
                  on
                    ? 'bg-[#2F63B8]/10 text-[#2F63B8]'
                    : 'bg-transparent text-[#37383C] hover:bg-black/5'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* 하단 사용자 화면 가기 및 로그아웃 */}
        <div className="mt-auto flex flex-col gap-2 border-t border-[#70737C]/15 pt-3">
          <Link
            href="/home"
            className="rounded-[8px] p-2 text-center text-[13px] font-medium text-[#2F63B8] hover:bg-[#2F63B8]/10"
          >
            ← 사생 화면으로 이동
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="cursor-pointer rounded-[8px] p-2 text-center text-[13px] font-bold text-[#E52222] hover:bg-[#E52222]/10"
          >
            관리자 로그아웃
          </button>
        </div>
      </aside>

      {/* 우측 메인 콘텐츠 영역 */}
      <main className="relative flex min-w-0 flex-1 flex-col gap-6 overflow-x-auto p-[28px_32px]">
        {/* ============================================================== */}
        {/* TAB 1: 실시간 기기 현황 (dashboard) */}
        {/* ============================================================== */}
        {tab === 'dashboard' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">실시간 기기 현황</h1>

            {maintenanceOn && (
              <div className="rounded-[12px] bg-[#E52222]/10 p-[12px_16px] text-[13px] font-semibold text-[#E52222]">
                점검 모드가 켜져 있어요. 모든 사용자가 줄서기를 이용할 수 없어요.
              </div>
            )}

            {/* 세탁실 점검 모드 토글 */}
            <div className="flex w-[200px] items-center gap-4">
              <div
                onClick={toggleMaintenance}
                className="flex cursor-pointer items-center gap-[9px] rounded-[12px] bg-white p-[10px_14px] shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]"
              >
                <span
                  className={`whitespace-nowrap text-[13px] font-bold ${
                    maintenanceOn ? 'text-[#E52222]' : 'text-[#37383C]'
                  }`}
                >
                  세탁실 점검 모드
                </span>
                <div
                  className={`relative h-[24px] w-[40px] flex-shrink-0 rounded-full transition-colors ${
                    maintenanceOn ? 'bg-[#E52222]' : 'bg-[#DFE7F1]'
                  }`}
                >
                  <div
                    className={`absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(20,42,84,0.22)] transition-all ${
                      maintenanceOn ? 'left-[18px]' : 'left-[2px]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* 통계 요약 카드 */}
            <div className="grid w-[641px] grid-cols-3 gap-3">
              <div className="flex w-[180px] flex-col gap-1 rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <span className="text-[12px] text-[#37383C]/60">세탁기 사용중</span>
                <span className="text-[24px] font-extrabold text-[#2F63B8]">
                  {washerInUse}/{washerTotal}
                </span>
              </div>
              <div className="flex w-[180px] flex-col gap-1 rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <span className="text-[12px] text-[#37383C]/60">건조기 사용중</span>
                <span className="text-[24px] font-extrabold text-[#FF4955]">
                  {dryerInUse}/{dryerTotal}
                </span>
              </div>
              <div className="flex w-[180px] flex-col gap-1 rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <span className="text-[12px] text-[#37383C]/60">고장 기기</span>
                <span className="text-[24px] font-extrabold text-[#E52222]">
                  {faultCount}대
                </span>
              </div>
            </div>

            {/* 기기 목록 테이블 */}
            <div className="flex flex-col gap-3">
              <div className="text-[16px] font-bold">기기 목록</div>
              <div className="w-[890px] overflow-hidden rounded-[14px] bg-white shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <div className="grid grid-cols-[1.4fr_1fr_1fr_200px] border-b border-[#70737C]/10 p-[12px_16px] text-[15px] font-bold text-[#37383C]/60">
                  <span>기기</span>
                  <span>상태</span>
                  <span>남은 시간</span>
                  <span>관리</span>
                </div>
                {machines.map((m) => {
                  const isFault = faults[m.id] !== undefined ? faults[m.id] : m.status === 'fault';
                  const currentStatus = isFault ? 'fault' : m.status;
                  const statusLabel = isFault ? '고장' : currentStatus === 'inuse' ? '사용중' : '사용가능';
                  const statusColor = isFault ? '#E52222' : currentStatus === 'inuse' ? '#2F63B8' : '#34B37E';

                  return (
                    <div
                      key={m.id}
                      className="grid grid-cols-[1.4fr_1fr_1fr_200px] items-center border-b border-[#70737C]/10 p-[12px_16px] text-[14px]"
                    >
                      <span className="font-bold text-[15px]">{m.name}</span>
                      <span className="flex items-center gap-1.5 font-semibold" style={{ color: statusColor }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
                        {statusLabel}
                      </span>
                      <span className="text-[#37383C]/60">
                        {currentStatus === 'inuse' && m.remaining ? `${m.remaining}분` : '-'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFault(m.id)}
                          className={`cursor-pointer rounded-[8px] p-[6px_10px] text-[12px] font-bold whitespace-nowrap ${
                            isFault
                              ? 'border border-[#70737C]/20 bg-transparent text-[#171719]'
                              : 'border border-[#FF4242]/30 bg-transparent text-[#E52222]'
                          }`}
                        >
                          {isFault ? '고장 해제' : '고장 처리'}
                        </button>
                        {currentStatus === 'inuse' && (
                          <button
                            type="button"
                            onClick={() => forceReset(m.id)}
                            className="cursor-pointer rounded-[8px] border border-[#70737C]/20 bg-transparent p-[6px_10px] text-[12px] font-bold text-[#171719] whitespace-nowrap"
                          >
                            초기화
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveTarget(m)}
                          className="cursor-pointer rounded-[8px] border border-[#FF4242]/30 bg-transparent p-[6px_10px] text-[12px] font-bold text-[#E52222] whitespace-nowrap"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 기기 추가 폼 */}
            <div className="flex flex-col gap-3">
              <div className="text-[16px] font-bold">기기 추가</div>
              <div className="flex h-[61px] w-[892px] items-center gap-2 rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <input
                  type="text"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  placeholder={newMachineType === 'dryer' ? '예: 건조기 5호기' : '예: 세탁기 9호기'}
                  className="w-[180px] rounded-[10px] border border-[#70737C]/20 p-[8px_12px] text-[13px] focus:outline-none"
                />
                <div className="flex gap-1 rounded-[10px] bg-[#EAEBEC] p-[3px]">
                  <button
                    type="button"
                    onClick={() => setNewMachineType('washer')}
                    className={`cursor-pointer rounded-[8px] p-[6px_12px] text-[12px] font-bold ${
                      newMachineType === 'washer' ? 'bg-white text-[#171719]' : 'text-[#37383C]/60'
                    }`}
                  >
                    세탁기
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMachineType('dryer')}
                    className={`cursor-pointer rounded-[8px] p-[6px_12px] text-[12px] font-bold ${
                      newMachineType === 'dryer' ? 'bg-white text-[#171719]' : 'text-[#37383C]/60'
                    }`}
                  >
                    건조기
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmAddOpen(true)}
                  disabled={!newMachineName.trim()}
                  className="cursor-pointer rounded-[10px] bg-[#2F63B8] p-[8px_16px] text-[13px] font-bold text-white disabled:opacity-50"
                >
                  기기 추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: 실시간 대기열 현황 (queue) */}
        {/* ============================================================== */}
        {tab === 'queue' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">실시간 대기열 현황</h1>
            <div className="grid grid-cols-2 gap-4">
              {/* 세탁기 대기열 카드 */}
              <div className="flex flex-col gap-4 rounded-[16px] bg-white p-5 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-extrabold">세탁기 대기열</span>
                  <span className="rounded-full bg-[#34B37E]/10 p-[4px_10px] text-[12px] font-bold text-[#188A5E]">
                    여유 · 1명
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[30px] font-extrabold text-[#2F63B8]">1</span>
                  <span className="text-[13px] text-[#37383C]/60">명 대기 중</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12px] text-[#37383C]/60">
                    <span>대기 혼잡도</span>
                    <span>여유</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-[#EDEEF0]">
                    <div className="h-full w-[15%] rounded-full bg-[#34B37E]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1 rounded-[12px] bg-[#F7F7F8] p-3">
                    <span className="text-[11px] text-[#37383C]/50">다음 배정까지</span>
                    <span className="text-[15px] font-bold">약 5분 후</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[12px] bg-[#F7F7F8] p-3">
                    <span className="text-[11px] text-[#37383C]/50">1인당 평균 대기</span>
                    <span className="text-[15px] font-bold">약 10분</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-bold text-[#37383C]/60">대기 순번</span>
                  <div className="flex items-center gap-2.5 rounded-[10px] bg-[#2F63B8]/10 p-[9px_10px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2F63B8] text-[11px] font-extrabold text-white">
                      1
                    </span>
                    <span className="flex-1 text-[12.5px] text-[#37383C]">
                      병찬 · 302호 (앱 사용자)
                    </span>
                    <span className="text-[11.5px] text-[#37383C]/50">약 5분 후</span>
                  </div>
                </div>
              </div>

              {/* 건조기 대기열 카드 */}
              <div className="flex flex-col gap-4 rounded-[16px] bg-white p-5 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-extrabold">건조기 대기열</span>
                  <span className="rounded-full bg-[#D98324]/10 p-[4px_10px] text-[12px] font-bold text-[#9C5800]">
                    보통 · 2명
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[30px] font-extrabold text-[#2F63B8]">2</span>
                  <span className="text-[13px] text-[#37383C]/60">명 대기 중</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12px] text-[#37383C]/60">
                    <span>대기 혼잡도</span>
                    <span>보통</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-[#EDEEF0]">
                    <div className="h-full w-[45%] rounded-full bg-[#D98324]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1 rounded-[12px] bg-[#F7F7F8] p-3">
                    <span className="text-[11px] text-[#37383C]/50">다음 배정까지</span>
                    <span className="text-[15px] font-bold">약 12분 후</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-[12px] bg-[#F7F7F8] p-3">
                    <span className="text-[11px] text-[#37383C]/50">1인당 평균 대기</span>
                    <span className="text-[15px] font-bold">약 20분</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-bold text-[#37383C]/60">대기 순번</span>
                  <div className="flex items-center gap-2.5 rounded-[10px] bg-[#F7F7F8] p-[9px_10px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DADCE0] text-[11px] font-extrabold text-[#5A5C63]">
                      1
                    </span>
                    <span className="flex-1 text-[12.5px] text-[#37383C]">정주희 · 210호</span>
                    <span className="text-[11.5px] text-[#37383C]/50">약 12분 후</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-[10px] bg-[#F7F7F8] p-[9px_10px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DADCE0] text-[11px] font-extrabold text-[#5A5C63]">
                      2
                    </span>
                    <span className="flex-1 text-[12.5px] text-[#37383C]">이서연 · 108호</span>
                    <span className="text-[11.5px] text-[#37383C]/50">약 24분 후</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 신고 내역 (reports) */}
        {/* ============================================================== */}
        {tab === 'reports' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">신고 내역</h1>

            {/* 필터 알약 버튼 */}
            <div className="flex gap-2">
              {['전체', '접수됨', '처리중', '처리완료', '반려'].map((label) => {
                const on = reportFilter === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setReportFilter(label)}
                    className={`cursor-pointer rounded-full p-[8px_14px] text-[12.5px] font-bold transition-all ${
                      on
                        ? 'bg-[#2F63B8] text-white'
                        : 'border border-[#2F63B8]/30 bg-white text-[#2F63B8]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* 신고 목록 카드 */}
            <div className="flex w-[890px] flex-col gap-3">
              {filteredReports.map((r) => {
                const currentStatus = reportsStatus[r.id] || '접수됨';
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#171719]">{r.reason}</span>
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-[#70737C]">
                          {r.datetime}
                        </span>
                      </div>
                      <div className="text-[13px] text-[#70737C]">
                        신고자: <span className="font-semibold text-[#171719]">{r.reporter}</span> · {r.detail}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-[8px] bg-[#2F63B8]/10 px-3 py-1 text-[13px] font-bold text-[#2F63B8]">
                        {currentStatus}
                      </span>
                      {currentStatus === '접수됨' && (
                        <button
                          type="button"
                          onClick={() => setReportsStatus({ ...reportsStatus, [r.id]: '처리중' })}
                          className="cursor-pointer rounded-[8px] bg-[#2F63B8] px-3 py-1 text-[12px] font-bold text-white"
                        >
                          처리 시작
                        </button>
                      )}
                      {currentStatus === '처리중' && (
                        <button
                          type="button"
                          onClick={() => setReportsStatus({ ...reportsStatus, [r.id]: '처리완료' })}
                          className="cursor-pointer rounded-[8px] bg-[#34B37E] px-3 py-1 text-[12px] font-bold text-white"
                        >
                          완료 처리
                        </button>
                      )}
                      {currentStatus !== '처리완료' && currentStatus !== '반려' && (
                        <button
                          type="button"
                          onClick={() => setReportsStatus({ ...reportsStatus, [r.id]: '반려' })}
                          className="cursor-pointer rounded-[8px] border border-[#E52222]/30 px-3 py-1 text-[12px] font-bold text-[#E52222]"
                        >
                          반려
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: 이용 내역 (history) */}
        {/* ============================================================== */}
        {tab === 'history' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">이용 내역</h1>
            <div className="flex gap-3">
              <select
                value={historyMachine}
                onChange={(e) => setHistoryMachine(e.target.value)}
                className="rounded-[10px] border border-[#70737C]/20 bg-white p-[8px_12px] text-[13px] font-bold"
              >
                <option value="전체">전체 기기</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
                className="rounded-[10px] border border-[#70737C]/20 bg-white p-[8px_12px] text-[13px] font-bold"
              >
                <option value="전체">전체 기간</option>
                <option value="2026.09">2026년 9월</option>
                <option value="2026.08">2026년 8월</option>
                <option value="2026.07">2026년 7월</option>
              </select>
            </div>

            <div className="w-[890px] overflow-hidden rounded-[14px] bg-white shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
              <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr] border-b border-[#70737C]/10 p-[12px_16px] text-[15px] font-bold text-[#37383C]/60">
                <span>기기</span>
                <span>사용자 (학번 · 호실)</span>
                <span>이용 시간</span>
                <span>결과</span>
              </div>
              {[
                { machine: '세탁기 1호기', user: '원병찬 (20231234 · 302호)', time: '09/10 09:12 ~ 10:04', status: '완료' },
                { machine: '세탁기 2호기', user: '정주희 (20230210 · 210호)', time: '09/08 19:30 ~ 20:22', status: '완료' },
                { machine: '건조기 1호기', user: '이태연 (20224120 · 412호)', time: '09/09 21:04 ~ 21:42', status: '경고' },
                { machine: '건조기 2호기', user: '이서연 (20221080 · 108호)', time: '09/06 18:33 ~ 19:11', status: '경고' },
              ].map((h, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr] items-center border-b border-[#70737C]/10 p-[12px_16px] text-[14px]"
                >
                  <span className="font-bold">{h.machine}</span>
                  <span>{h.user}</span>
                  <span className="text-[#37383C]/60">{h.time}</span>
                  <span className={`font-bold ${h.status === '경고' ? 'text-[#E52222]' : 'text-[#34B37E]'}`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: 경고 누적 사용자 (warnings) */}
        {/* ============================================================== */}
        {tab === 'warnings' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">경고 누적 사용자</h1>

            <div className="flex items-center gap-2">
              <select
                value={warnMonth}
                onChange={(e) => setWarnMonth(e.target.value)}
                className="rounded-[10px] border border-[#70737C]/20 bg-white p-[8px_14px] text-[13px] font-bold"
              >
                <option value="2026.09">2026년 9월</option>
                <option value="2026.08">2026년 8월</option>
                <option value="2026.07">2026년 7월</option>
              </select>
            </div>

            <div className="w-[890px] flex flex-col gap-3">
              {[
                { name: '이태연', room: '412호', studentId: '20224120', count: 3, reasons: ['다했어요 미클릭', '배정 후 10분 내 미시작'] },
                { name: '이서연', room: '108호', studentId: '20221080', count: 1, reasons: ['배정 후 10분 내 미시작'] },
                { name: '조성원', room: '306호', studentId: '20220630', count: 2, reasons: ['순서 미준수 (신고)', '다했어요 미클릭'] },
              ].map((u) => {
                const key = `${u.name}·${u.room}`;
                const expanded = warnOpen[key];
                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-3 rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)] ${
                      u.count >= 3 ? 'bg-[#E52222]/[0.03] border border-[#E52222]/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-bold text-[#171719]">{u.name}</span>
                        <span className="text-[13px] text-[#70737C]">{u.studentId} · {u.room}</span>
                        {u.count >= 3 && (
                          <span className="rounded-full bg-[#E52222] px-2.5 py-0.5 text-[11px] font-bold text-white">
                            이용정지 · 2일 남음
                          </span>
                        )}
                      </div>

                      {/* 3칸 게이지 */}
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map((idx) => {
                          const filled = idx < u.count;
                          const color = u.count >= 3 ? '#E52222' : u.count === 2 ? '#D98324' : '#2F63B8';
                          return (
                            <div
                              key={idx}
                              className="h-2 w-6 rounded-full"
                              style={{ backgroundColor: filled ? color : 'rgba(112,115,124,0.16)' }}
                            />
                          );
                        })}
                        <span className="ml-2 text-[13px] font-bold text-[#70737C]">
                          {u.count} / 3
                        </span>
                      </div>
                    </div>

                    {/* 사유 펼치기 */}
                    <div className="text-[12.5px] text-[#70737C]">
                      최근 사유: <span className="text-[#171719] font-medium">{u.reasons[0]}</span>
                      {u.reasons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setWarnOpen({ ...warnOpen, [key]: !expanded })}
                          className="ml-2 cursor-pointer font-bold text-[#2F63B8]"
                        >
                          {expanded ? '접기 ⌃' : `외 ${u.reasons.length - 1}건 ⌄`}
                        </button>
                      )}
                    </div>
                    {expanded && u.reasons.length > 1 && (
                      <div className="flex flex-col gap-1 rounded-[8px] bg-black/5 p-2 text-[12px] text-[#70737C]">
                        {u.reasons.slice(1).map((r, i) => (
                          <span key={i}>· {r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: 공지사항 (notice) */}
        {/* ============================================================== */}
        {tab === 'notice' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">공지사항</h1>

            {/* 새 공지 등록 카드 */}
            <div className="w-[890px] rounded-[14px] bg-white p-5 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
              <div className="text-[16px] font-bold mb-3">새 공지 등록</div>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="공지 제목을 입력해주세요"
                  className="rounded-[10px] border border-[#70737C]/20 p-[10px_14px] text-[14px] focus:outline-none"
                />
                <textarea
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  placeholder="공지 내용을 입력해주세요"
                  rows={3}
                  className="rounded-[10px] border border-[#70737C]/20 p-[10px_14px] text-[14px] focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmPostOpen(true)}
                    disabled={!noticeTitle.trim()}
                    className="cursor-pointer rounded-[10px] bg-[#2F63B8] p-[8px_18px] text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    공지 등록
                  </button>
                </div>
              </div>
            </div>

            {/* 공지 목록 */}
            <div className="w-[890px] flex flex-col gap-3">
              <div className="text-[16px] font-bold">등록된 공지 목록</div>
              {notices.map((n, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between rounded-[14px] bg-white p-4 shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-[#171719]">{n.title}</span>
                      <span className="text-[12px] text-[#70737C]">{n.date}</span>
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-[#37383C]">{n.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmNoticeDelete(n)}
                    className="cursor-pointer rounded-[8px] border border-[#E52222]/30 px-3 py-1 text-[12px] font-bold text-[#E52222]"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 7: 사용자 목록 (users) */}
        {/* ============================================================== */}
        {tab === 'users' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-[20px] font-extrabold">사용자 목록</h1>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="사생 이름 검색"
                className="w-[200px] rounded-[10px] border border-[#70737C]/20 bg-white p-[8px_12px] text-[13px] focus:outline-none"
              />
              <select
                value={userRoomFilter}
                onChange={(e) => setUserRoomFilter(e.target.value)}
                className="rounded-[10px] border border-[#70737C]/20 bg-white p-[8px_12px] text-[13px] font-bold"
              >
                <option value="전체">전체 호실</option>
                <option value="108호">108호</option>
                <option value="115호">115호</option>
                <option value="210호">210호</option>
                <option value="302호">302호</option>
                <option value="306호">306호</option>
                <option value="412호">412호</option>
              </select>
            </div>

            <div className="w-[890px] overflow-hidden rounded-[14px] bg-white shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)]">
              <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_180px] border-b border-[#70737C]/10 p-[12px_16px] text-[15px] font-bold text-[#37383C]/60">
                <span>이름 (소속)</span>
                <span>학번</span>
                <span>호실</span>
                <span>경고 현황</span>
                <span>경고 관리</span>
              </div>
              {filteredUsers.map((u) => {
                const userKey = `${u.name}·${u.room}`;
                const current = userWarnings[userKey] || { count: u.baseWarn, suspendedUntil: null };
                const isSuspended = current.count >= 3;

                return (
                  <div
                    key={userKey}
                    className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_180px] items-center border-b border-[#70737C]/10 p-[12px_16px] text-[14px]"
                  >
                    <span className="font-bold">
                      {u.name} <span className="text-[12px] font-normal text-[#70737C]">({u.school})</span>
                    </span>
                    <span className="text-[#37383C]/80 font-mono">{u.studentId}</span>
                    <span>{u.room}</span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <span
                        className={
                          current.count >= 3
                            ? 'text-[#E52222]'
                            : current.count >= 1
                            ? 'text-[#D98324]'
                            : 'text-[#37383C]'
                        }
                      >
                        {current.count}회
                      </span>
                      {isSuspended && (
                        <span className="rounded bg-[#E52222]/10 px-1.5 py-0.5 text-[11px] text-[#E52222]">
                          제한중
                        </span>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => adjustWarning(userKey, 1)}
                        className="cursor-pointer rounded-[8px] bg-[#2F63B8] px-2.5 py-1 text-[12px] font-bold text-white hover:opacity-90"
                      >
                        +1 경고
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustWarning(userKey, -1)}
                        disabled={current.count <= 0}
                        className="cursor-pointer rounded-[8px] border border-[#70737C]/20 px-2.5 py-1 text-[12px] font-bold text-[#171719] disabled:opacity-40"
                      >
                        -1 차감
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 모달 1: 기기 추가 확인 */}
      {confirmAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-[320px] flex-col gap-4 rounded-[16px] bg-white p-5 shadow-xl">
            <div className="text-[16px] font-extrabold text-[#171719]">기기 추가 확인</div>
            <p className="text-[13px] text-[#70737C]">
              &apos;{newMachineName}&apos; 기기를 추가하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAddOpen(false)}
                className="flex-1 rounded-[10px] border border-[#70737C]/20 p-2 text-[13px] font-bold text-[#70737C]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddMachine}
                className="flex-1 rounded-[10px] bg-[#2F63B8] p-2 text-[13px] font-bold text-white"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 기기 삭제 확인 */}
      {confirmRemoveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-[320px] flex-col gap-4 rounded-[16px] bg-white p-5 shadow-xl">
            <div className="text-[16px] font-extrabold text-[#E52222]">기기 삭제 확인</div>
            <p className="text-[13px] text-[#70737C]">
              &apos;{confirmRemoveTarget.name}&apos; 기기를 목록에서 완전히 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveTarget(null)}
                className="flex-1 rounded-[10px] border border-[#70737C]/20 p-2 text-[13px] font-bold text-[#70737C]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmRemoveMachine}
                className="flex-1 rounded-[10px] bg-[#E52222] p-2 text-[13px] font-bold text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 공지 등록 확인 */}
      {confirmPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-[320px] flex-col gap-4 rounded-[16px] bg-white p-5 shadow-xl">
            <div className="text-[16px] font-extrabold text-[#171719]">공지 등록 확인</div>
            <p className="text-[13px] text-[#70737C]">
              &apos;{noticeTitle}&apos; 공지를 사생들에게 등록하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmPostOpen(false)}
                className="flex-1 rounded-[10px] border border-[#70737C]/20 p-2 text-[13px] font-bold text-[#70737C]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePostNotice}
                className="flex-1 rounded-[10px] bg-[#2F63B8] p-2 text-[13px] font-bold text-white"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 4: 공지 삭제 확인 */}
      {confirmNoticeDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-[320px] flex-col gap-4 rounded-[16px] bg-white p-5 shadow-xl">
            <div className="text-[16px] font-extrabold text-[#E52222]">공지 삭제 확인</div>
            <p className="text-[13px] text-[#70737C]">
              &apos;{confirmNoticeDelete.title}&apos; 공지를 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmNoticeDelete(null)}
                className="flex-1 rounded-[10px] border border-[#70737C]/20 p-2 text-[13px] font-bold text-[#70737C]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteNotice}
                className="flex-1 rounded-[10px] bg-[#E52222] p-2 text-[13px] font-bold text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
