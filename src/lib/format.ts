// 화면에 쓰는 날짜 · 시간 표기. 서버 · 클라이언트 양쪽에서 쓰므로 'server-only' 가 없다.

/** "오늘" · "어제" · "9월 6일 (토)" (알림함 · 기록의 날짜 묶음 머리글) */
export function dateLabel(iso: string): string {
  const d = new Date(iso);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const day = new Date(d);
  day.setHours(0, 0, 0, 0);

  const offset = Math.round((midnight.getTime() - day.getTime()) / 86400000);
  if (offset === 0) return '오늘';
  if (offset === 1) return '어제';

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][day.getDay()];
  return `${day.getMonth() + 1}월 ${day.getDate()}일 (${weekday})`;
}

/** "09:41" */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 두 시각 사이를 "52분" · "1시간 12분" 으로 */
export function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 그 시각까지 며칠 남았는지(올림 · 최소 0). 이미 지났으면 0이다.
 *
 * 컴포넌트 안에서 `Date.now()` 를 직접 부르면 렌더마다 값이 달라져(react-hooks/purity)
 * 화면이 제자리에 있지 않다. 남은 날짜는 **서버에서 한 번 세어** 숫자로 넘긴다.
 */
export function daysLeftUntil(iso: string): number {
  const left = new Date(iso).getTime() - Date.now();
  return left <= 0 ? 0 : Math.max(1, Math.ceil(left / 86400000));
}

/** 그 시각 + N일까지 며칠 남았는지 (탈퇴 14일 유예 · 05 P24) */
export function daysLeftAfter(iso: string, days: number): number {
  return daysLeftUntil(new Date(new Date(iso).getTime() + days * 86400000).toISOString());
}

/** 묶음 머리글이 같은 것끼리 순서를 지키며 묶는다 */
export function groupByDate<T>(rows: T[], isoOf: (row: T) => string): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const row of rows) {
    const label = dateLabel(isoOf(row));
    const last = groups[groups.length - 1];
    if (last && last.date === label) last.items.push(row);
    else groups.push({ date: label, items: [row] });
  }
  return groups;
}
