// 기록 화면 (F13) — 06 「이용 내역」 · 「경고」 · 「이용 제한」 · 05 P7 · P21.
//
// **조회는 30일이다**(P21). 보관은 3개월이지만(SP4) 사생 화면은 30일만 본다 —
// 경고 사유 목록도 같이 30일로 자른다(07 「기록 · 경고 카드」).
// 다만 **누적 횟수는 기간과 무관한 현재값**이다(P7) — usage_restrictions 를 그대로 읽는다.

import 'server-only';

import { sql } from '@/lib/db';
import { daysLeftUntil } from '@/lib/format';
import type { MachineKind } from '@/lib/queue';

const VIEW_DAYS = 30;

export type HistoryRow = {
  history_id: string;
  machine_name: string | null;
  machine_kind: MachineKind | null;
  started_at: string;
  ended_at: string;
  result: '완료' | '경고';
};

export type WarningRow = {
  warning_id: string;
  reason: '배정 후 미인증' | '수거 미완료' | '신고 확인';
  issued_by: '시스템 자동' | '관리자';
  issued_at: string;
};

export async function getHistoryData(userId: string) {
  const usage = await sql<HistoryRow>`
    SELECT h.history_id, m.name AS machine_name, m.kind AS machine_kind,
           h.started_at, h.ended_at, h.result
      FROM usage_history h
      LEFT JOIN machines m ON m.machine_id = h.machine_id
     WHERE h.user_id = ${userId}
       AND h.started_at >= now() - make_interval(days => ${VIEW_DAYS}::int)
     ORDER BY h.started_at DESC
  `;

  const warnings = await sql<WarningRow>`
    SELECT warning_id, reason, issued_by, issued_at
      FROM warnings
     WHERE user_id = ${userId}
       AND issued_at >= now() - make_interval(days => ${VIEW_DAYS}::int)
     ORDER BY issued_at DESC
  `;

  // P7 — 누적 횟수와 제한은 현재값이다(기간으로 자르지 않는다).
  const [restriction] = await sql<{ warning_count: number; restricted_until: string | null }>`
    SELECT warning_count, restricted_until FROM usage_restrictions WHERE user_id = ${userId}
  `;

  const totalMinutes = usage.reduce(
    (sum, row) =>
      sum +
      Math.max(0, Math.round((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000)),
    0,
  );

  return {
    usage,
    warnings,
    useCount: usage.length,
    totalMinutes,
    warningCount: restriction?.warning_count ?? 0,
    restrictedDaysLeft: restriction?.restricted_until
      ? daysLeftUntil(restriction.restricted_until)
      : 0,
  };
}
