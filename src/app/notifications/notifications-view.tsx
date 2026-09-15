'use client';

// 알림함 화면 로직 (F17) — docs/design/알림.dc.html 을 서버 데이터에 맞췄다.
//
// 탭 이름은 06 「알림」의 종류값을 그대로 쓴다(공지 · 배정 · 종료 · 경고 · **결과**).
// 디자인에는 마지막 탭이 "신고" 로 적혀 있지만 저장값은 「결과」다 —
// docs 가 기준이라(05 머리말) 저장값 쪽을 따랐다.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { groupByDate, timeLabel } from '@/lib/format';
import type { NotificationKind, NotificationRow } from '@/lib/notifications';

type Filter = '전체' | NotificationKind;

const TABS: Filter[] = ['전체', '공지', '배정', '종료', '경고', '결과'];

const STYLES: Record<NotificationKind, { pill: string; dot: string }> = {
  공지: { pill: 'bg-primary-soft text-text/60', dot: 'bg-text/25' },
  배정: { pill: 'bg-primary/10 text-primary-strong', dot: 'bg-primary-strong' },
  종료: { pill: 'bg-positive/10 text-positive-text', dot: 'bg-positive' },
  경고: { pill: 'bg-cautionary/12 text-cautionary-text', dot: 'bg-cautionary' },
  결과: { pill: 'bg-notice/12 text-notice-text', dot: 'bg-notice' },
};

function emptyTitle(filter: Filter): string {
  if (filter === '전체') return '받은 알림이 없어요';
  if (filter === '배정') return '배정된 알림이 없어요';
  if (filter === '결과') return '신고에 대한 결과가 없어요';
  return `${filter} 알림이 없어요`;
}

export function NotificationsView({ rows }: { rows: NotificationRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('전체');
  const [pending, setPending] = useState(false);

  const unreadCount = rows.filter((n) => !n.is_read).length;
  const visible = rows.filter((n) => filter === '전체' || n.kind === filter);
  const groups = groupByDate(visible, (n) => n.received_at);

  async function markRead(notificationId: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    router.refresh();
  }

  async function markAllRead() {
    setPending(true);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-text/60">읽지 않은 알림 {unreadCount}개</span>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0 || pending}
            className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-primary-strong ring-1 ring-inset ring-primary-soft disabled:bg-transparent disabled:text-text/25 disabled:ring-0"
          >
            모두 읽음
          </button>
        </div>

        <div className="no-scrollbar mt-3 overflow-x-auto">
          <div className="flex w-max gap-1.5 pb-0.5">
            {TABS.map((tab) => {
              const count =
                tab === '전체'
                  ? unreadCount
                  : rows.filter((n) => n.kind === tab && !n.is_read).length;
              const on = filter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold ${
                    on
                      ? 'bg-primary text-surface'
                      : 'bg-surface text-text/60 ring-1 ring-inset ring-primary-soft'
                  }`}
                >
                  {count > 0 ? `${tab} ${count}` : tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pb-7 pt-1.5">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
              {/* 디자인(알림.dc.html)의 빈 상태 종 그림 */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 9a6 6 0 1 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 13 6 9Z"
                    stroke="#A8BCD9"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="M10 18a2 2 0 0 0 4 0" stroke="#A8BCD9" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-md font-bold text-text/60">{emptyTitle(filter)}</div>
              <div className="text-sm text-text/40">새 알림이 오면 여기에 쌓여요</div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.date} className="flex flex-col gap-2">
                <div className="ml-0.5 text-xs font-bold text-text/60">{group.date}</div>
                <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-inset ring-primary-soft">
                  {group.items.map((n) => {
                    const style = STYLES[n.kind];
                    return (
                      <button
                        key={n.notification_id}
                        type="button"
                        onClick={() => !n.is_read && markRead(n.notification_id)}
                        className="flex w-full gap-3 border-b border-primary-soft px-4 py-3.5 text-left last:border-b-0"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                            n.is_read ? 'bg-transparent' : style.dot
                          }`}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.pill}`}
                            >
                              {n.kind}
                            </span>
                            <span className="ml-auto flex-shrink-0 text-[11px] text-text/40">
                              {timeLabel(n.received_at)}
                            </span>
                          </span>
                          <span
                            className={`text-sm leading-tight ${
                              n.is_read ? 'font-medium text-text/70' : 'font-bold text-text'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-xs leading-tight text-text/60">{n.body}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
