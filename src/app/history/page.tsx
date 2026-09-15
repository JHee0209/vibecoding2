// 기록 (F13) — 07 화면 목록 「기록」 · docs/design/기록.dc.html.
//
// 조회는 최근 30일(P21). 누적 경고 횟수만 기간과 무관한 현재값이다(P7) —
// 그래서 위 통계의 "받은 경고" 와 아래 사유 목록의 개수가 다를 수 있다(의도된 것).

import Image from 'next/image';

import { auth } from '@/auth';
import { BottomNav } from '@/components/bottom-nav';
import { TopBar } from '@/components/top-bar';
import { durationLabel, groupByDate, timeLabel } from '@/lib/format';
import { getHistoryData } from '@/lib/history';
import { getUnreadCount } from '@/lib/notifications';

export default async function HistoryPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [data, unreadCount] = await Promise.all([getHistoryData(userId), getUnreadCount(userId)]);
  const { usage, warnings, useCount, totalMinutes, warningCount, restrictedDaysLeft } = data;

  const useHours =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}시간`
      : `${totalMinutes}분`;

  const groups = groupByDate(usage, (row) => row.started_at);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[var(--screen-width)] flex-col overflow-hidden bg-bg">
      <TopBar unreadCount={unreadCount} />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4">
          <div>
            <h1 className="text-xl font-black text-text">기록</h1>
            <p className="mt-1.5 text-sm text-text/60">최근 30일간의 세탁 · 건조 기록이에요</p>
          </div>

          <div className="flex rounded-lg bg-surface py-4 ring-1 ring-inset ring-primary-soft">
            <div className="flex-1 text-center">
              <div className="text-xl font-black leading-none text-primary-strong">{useCount}</div>
              <div className="mt-1.5 text-xs text-text/60">이용 횟수</div>
            </div>
            <div className="w-px bg-primary-soft" />
            <div className="flex-1 text-center">
              <div className="text-xl font-black leading-none text-primary-strong">{useHours}</div>
              <div className="mt-1.5 text-xs text-text/60">총 사용 시간</div>
            </div>
            <div className="w-px bg-primary-soft" />
            <div className="flex-1 text-center">
              <div className="text-xl font-black leading-none text-cautionary-text">
                {warningCount}
              </div>
              <div className="mt-1.5 text-xs text-text/60">받은 경고</div>
            </div>
          </div>

          {(warningCount > 0 || warnings.length > 0) && (
            <div className="flex flex-col gap-3 rounded-lg bg-cautionary/8 p-4 ring-1 ring-inset ring-cautionary/25">
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cautionary text-xs font-black text-surface">
                  !
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-cautionary-text">
                    누적 경고 {warningCount}회
                  </div>
                  <div className="mt-0.5 text-xs leading-tight text-cautionary-text/80">
                    {restrictedDaysLeft > 0
                      ? `이용 제한 중 · ${restrictedDaysLeft}일 남음`
                      : '누적 3회가 되면 3일 동안 줄서기를 할 수 없어요'}
                  </div>
                </div>
              </div>

              {warnings.map((w) => (
                <div
                  key={w.warning_id}
                  className="flex flex-col gap-0.5 rounded-sm bg-surface px-3 py-2.5 ring-1 ring-inset ring-cautionary/20"
                >
                  <span className="text-xs font-bold text-cautionary-text">
                    {new Date(w.issued_at).toLocaleDateString('ko-KR')} {timeLabel(w.issued_at)} ·{' '}
                    {w.reason}
                  </span>
                  <span className="text-xs text-cautionary-text/80">
                    {w.issued_by === '관리자' ? '관리자가 부여했어요' : '시스템이 자동으로 부여했어요'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <div className="text-md font-bold text-text/60">아직 이용 기록이 없어요</div>
              <div className="text-sm text-text/40">세탁 · 건조를 마치면 여기에 쌓여요</div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.date} className="relative pl-5">
                <div className="absolute bottom-1.5 left-[3px] top-1.5 w-0.5 rounded-full bg-primary-soft" />
                <div className="absolute left-0 top-1 h-2 w-2 rounded-full bg-primary ring-[3px] ring-primary-soft" />
                <div className="mb-2 text-xs font-bold text-text/60">{group.date}</div>

                <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-inset ring-primary-soft">
                  {group.items.map((row) => (
                    <div
                      key={row.history_id}
                      className="flex items-center gap-3 border-b border-primary-soft px-4 py-3.5 last:border-b-0"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-primary-soft">
                        <Image
                          src={`/icons/${row.machine_kind === '건조기' ? 'dryer' : 'washer'}-history.svg`}
                          alt=""
                          width={22}
                          height={22}
                        />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold">
                          {row.machine_name ?? '기기 정보 없음'}
                        </span>
                        <span className="mt-0.5 text-xs text-text/60">
                          {timeLabel(row.started_at)} · {durationLabel(row.started_at, row.ended_at)}{' '}
                          사용
                        </span>
                      </div>
                      <span
                        className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${
                          row.result === '경고' ? 'bg-cautionary/12' : 'bg-positive/10'
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${
                            row.result === '경고' ? 'bg-cautionary' : 'bg-positive'
                          }`}
                        />
                        <span
                          className={`text-[11px] font-bold ${
                            row.result === '경고' ? 'text-cautionary-text' : 'text-positive-text'
                          }`}
                        >
                          {row.result}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
