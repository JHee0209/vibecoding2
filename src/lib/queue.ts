// 홈 화면의 핵심 — 기기 현황 · 줄서기 · 배정 · QR · 타이머 · 경고 (F1 · F3~F10).
// 06 「기기」 · 「줄서기」 · 「경고」 · 「이용 제한」 · 「이용 내역」 · 05 P1~P7.
//
// **지금은 강한 트랜잭션(행 잠금)을 쓰지 않는다.** 08-deployNOTE.md 3번이 이미
// 적어 둔 알려진 한계 그대로다 — 기숙사 한 곳, 동시 사용자가 많지 않은 수준을
// 전제로, `queue_machine_once_idx`(기기 하나에 배정 하나) UNIQUE 제약이 최소한의
// 안전판 역할을 한다. 실제 배포 규모가 커지면 여기부터 트랜잭션으로 옮긴다.
//
// **서버 스케줄러 대신 "읽을 때마다 정리"한다.** reconcile() 이 배정 10분 초과 ·
// 사용 종료 · 수거 3분 초과를 그때그때 처리한다 — cron 이 아니라 홈 화면을 열거나
// 버튼을 누를 때마다 불린다(08-deployNOTE.md 4번 "서버 스케줄러"의 임시 대체).

import 'server-only';

import { sql } from '@/lib/db';
import { notify } from '@/lib/notify';

export type MachineKind = '세탁기' | '건조기';
export type QueueStatus = '대기 중' | '배정' | '사용중' | '수거대기';

const KINDS: MachineKind[] = ['세탁기', '건조기'];

const ASSIGN_WINDOW_MS = 10 * 60 * 1000; // P3
const PICKUP_WINDOW_MS = 3 * 60 * 1000; // P5
const RUN_MS: Record<MachineKind, number> = { 세탁기: 60 * 60 * 1000, 건조기: 45 * 60 * 1000 }; // P4
const RESTRICT_DAYS = 3; // P7

export class QueueError extends Error {}

export type Machine = {
  machine_id: string;
  name: string;
  kind: MachineKind;
  status: '사용가능' | '사용중' | '고장';
  ends_at: string | null;
};

export type QueueRow = {
  queue_id: string;
  user_id: string;
  machine_kind: MachineKind;
  machine_id: string | null;
  status: QueueStatus;
  queued_at: string;
  assigned_at: string | null;
  assign_deadline_at: string | null;
  pickup_deadline_at: string | null;
};

// ---------------------------------------------------------------------------
// 경고 · 이용 제한 (P6-1 · P7)
// ---------------------------------------------------------------------------

async function addWarning(userId: string, reason: '배정 후 미인증' | '수거 미완료'): Promise<void> {
  await sql`
    INSERT INTO warnings (user_id, reason, issued_by)
    VALUES (${userId}, ${reason}, '시스템 자동')
  `;

  const [row] = await sql<{ warning_count: number }>`
    INSERT INTO usage_restrictions (user_id, warning_count)
    VALUES (${userId}, 1)
    ON CONFLICT (user_id) DO UPDATE
      SET warning_count = usage_restrictions.warning_count + 1
    RETURNING warning_count
  `;

  // P7 — 3회가 쌓이면 3일 제한. 게이지가 "3 / 3" 을 보여줘야 하므로 3에서 멈춘다.
  if (row.warning_count >= 3) {
    await sql`
      UPDATE usage_restrictions
         SET warning_count = 3, restricted_from = now(),
             restricted_until = now() + make_interval(days => ${RESTRICT_DAYS}::int)
       WHERE user_id = ${userId}
    `;
  }

  await notify(userId, '경고', '경고가 1회 누적됐어요', reasonMessage(reason));
}

function reasonMessage(reason: '배정 후 미인증' | '수거 미완료'): string {
  return reason === '배정 후 미인증'
    ? '배정 후 10분 안에 QR 인증을 하지 않아 경고를 받았어요.'
    : '시간 내에 "다했어요"를 누르지 않아 경고를 받았어요.';
}

/** P7 — 제한 종료 시각이 지났으면 그 자리에서 0회로 되돌린다(매달 1일 초기화는 아직 배치가 없다). */
async function getRestriction(
  userId: string,
): Promise<{ warningCount: number; restrictedUntil: Date | null }> {
  const [row] = await sql<{ warning_count: number; restricted_until: string | null }>`
    SELECT warning_count, restricted_until FROM usage_restrictions WHERE user_id = ${userId}
  `;
  if (!row) return { warningCount: 0, restrictedUntil: null };

  if (row.restricted_until && new Date(row.restricted_until) <= new Date()) {
    await sql`
      UPDATE usage_restrictions
         SET warning_count = 0, restricted_from = NULL, restricted_until = NULL
       WHERE user_id = ${userId}
    `;
    return { warningCount: 0, restrictedUntil: null };
  }

  return {
    warningCount: row.warning_count,
    restrictedUntil: row.restricted_until ? new Date(row.restricted_until) : null,
  };
}

// ---------------------------------------------------------------------------
// 정리 — 배정 만료 · 사용 종료 · 수거 만료 (P3 · P4 · P5 · P6)
// ---------------------------------------------------------------------------

async function freeMachine(machineId: string): Promise<void> {
  await sql`UPDATE machines SET status = '사용가능', ends_at = NULL WHERE machine_id = ${machineId}`;
}

/** 기기가 막 비었을 때, 그 종류에서 가장 오래 기다린 사람에게 배정한다 (P2). */
async function promoteNextWaiter(machineId: string, machineKind: MachineKind): Promise<void> {
  const [next] = await sql<{ queue_id: string; user_id: string }>`
    SELECT queue_id, user_id FROM queue
     WHERE machine_kind = ${machineKind} AND status = '대기 중'
     ORDER BY queued_at ASC
     LIMIT 1
  `;
  if (!next) return;

  try {
    const deadline = new Date(Date.now() + ASSIGN_WINDOW_MS);
    await sql`
      UPDATE queue
         SET machine_id = ${machineId}, status = '배정',
             assigned_at = now(), assign_deadline_at = ${deadline}
       WHERE queue_id = ${next.queue_id}
    `;
    await sql`UPDATE machines SET status = '사용중', ends_at = ${deadline} WHERE machine_id = ${machineId}`;

    const [machine] = await sql<{ name: string }>`
      SELECT name FROM machines WHERE machine_id = ${machineId}
    `;
    await notify(
      next.user_id,
      '배정',
      `${machine.name} 차례가 됐어요`,
      '10분 안에 QR 코드를 찍어 시작해주세요.',
    );
  } catch (error) {
    // queue_machine_once_idx 위반 — 다른 요청이 먼저 이 기기를 채갔다. 다음 정리 때 다시 시도된다.
    console.error('배정 경합 — 건너뜀', error);
  }
}

/** 홈 화면을 열거나 줄서기 관련 버튼을 누를 때마다 부른다. */
export async function reconcile(): Promise<void> {
  const now = new Date();

  // P3 — 배정 후 10분 안에 QR 인증을 하지 않으면 배정 해제 + 경고
  const expiredAssignments = await sql<{ queue_id: string; user_id: string; machine_id: string; machine_kind: MachineKind }>`
    SELECT queue_id, user_id, machine_id, machine_kind FROM queue
     WHERE status = '배정' AND assign_deadline_at < ${now}
  `;
  for (const row of expiredAssignments) {
    await sql`DELETE FROM queue WHERE queue_id = ${row.queue_id}`;
    await freeMachine(row.machine_id);
    await addWarning(row.user_id, '배정 후 미인증');
    await promoteNextWaiter(row.machine_id, row.machine_kind);
  }

  // P4 → P5 — 사용 타이머가 끝나면 수거대기로 넘긴다
  const finishedRuns = await sql<{ queue_id: string; user_id: string; machine_name: string }>`
    SELECT q.queue_id, q.user_id, m.name AS machine_name
      FROM queue q JOIN machines m ON m.machine_id = q.machine_id
     WHERE q.status = '사용중' AND m.ends_at < ${now}
  `;
  for (const row of finishedRuns) {
    const deadline = new Date(Date.now() + PICKUP_WINDOW_MS);
    await sql`UPDATE queue SET status = '수거대기', pickup_deadline_at = ${deadline} WHERE queue_id = ${row.queue_id}`;
    await notify(
      row.user_id,
      '종료',
      `${row.machine_name} 이용이 끝났어요`,
      '3분 안에 세탁물을 수거하고 "다했어요"를 눌러주세요.',
    );
  }

  // P5 · P6 — 수거 3분을 넘기면 경고 + 기기 반환, 이용 내역엔 "경고"로 남는다
  const expiredPickups = await sql<{
    queue_id: string;
    user_id: string;
    machine_id: string;
    machine_kind: MachineKind;
    ends_at: string;
  }>`
    SELECT q.queue_id, q.user_id, q.machine_id, q.machine_kind, m.ends_at
      FROM queue q JOIN machines m ON m.machine_id = q.machine_id
     WHERE q.status = '수거대기' AND q.pickup_deadline_at < ${now}
  `;
  for (const row of expiredPickups) {
    const endedAt = new Date(row.ends_at);
    const startedAt = new Date(endedAt.getTime() - RUN_MS[row.machine_kind]);
    await sql`DELETE FROM queue WHERE queue_id = ${row.queue_id}`;
    await sql`
      INSERT INTO usage_history (user_id, machine_id, started_at, ended_at, result)
      VALUES (${row.user_id}, ${row.machine_id}, ${startedAt}, ${endedAt}, '경고')
    `;
    await freeMachine(row.machine_id);
    await addWarning(row.user_id, '수거 미완료');
    await promoteNextWaiter(row.machine_id, row.machine_kind);
  }
}

// ---------------------------------------------------------------------------
// 사생이 누르는 동작 (F3 · F4 · F7 · F8 · F10)
// ---------------------------------------------------------------------------

export async function joinQueue(userId: string, kind: MachineKind): Promise<void> {
  await reconcile();

  const { restrictedUntil } = await getRestriction(userId);
  if (restrictedUntil) throw new QueueError('경고 누적으로 이용이 제한되어 있어요.');

  const [existing] = await sql<{ queue_id: string }>`
    SELECT queue_id FROM queue WHERE user_id = ${userId} AND machine_kind = ${kind}
  `;
  if (existing) throw new QueueError('이미 대기열에 참여 중이에요.'); // P1

  const [free] = await sql<{ machine_id: string; name: string }>`
    SELECT machine_id, name FROM machines
     WHERE kind = ${kind} AND status = '사용가능'
     ORDER BY name
     LIMIT 1
  `;

  if (free) {
    // F4 — 바로 배정
    const deadline = new Date(Date.now() + ASSIGN_WINDOW_MS);
    try {
      await sql`
        INSERT INTO queue (user_id, machine_kind, machine_id, status, assigned_at, assign_deadline_at)
        VALUES (${userId}, ${kind}, ${free.machine_id}, '배정', now(), ${deadline})
      `;
      await sql`UPDATE machines SET status = '사용중', ends_at = ${deadline} WHERE machine_id = ${free.machine_id}`;
      await notify(
        userId,
        '배정',
        `${free.name} 차례가 됐어요`,
        '10분 안에 QR 코드를 찍어 시작해주세요.',
      );
    } catch {
      throw new QueueError('방금 다른 사람에게 배정됐어요. 다시 시도해주세요.');
    }
    return;
  }

  // F3 — 대기열에 참여
  await sql`
    INSERT INTO queue (user_id, machine_kind, status)
    VALUES (${userId}, ${kind}, '대기 중')
  `;
}

export async function leaveQueue(userId: string, kind: MachineKind): Promise<void> {
  await reconcile();

  // P3 — 배정 상태에서는 줄 빠지기를 할 수 없다. 대기 중일 때만 지운다.
  await sql`
    DELETE FROM queue WHERE user_id = ${userId} AND machine_kind = ${kind} AND status = '대기 중'
  `;
}

/**
 * 그 사람의 줄을 전부 치운다 — 탈퇴 신청(F36 · P24)처럼 이용이 즉시 정지될 때 쓴다.
 * 쥐고 있던 기기는 돌려주고 다음 대기자에게 넘긴다(그냥 줄만 지우면 기기가
 * 영원히 「사용중」으로 남는다). 이용 내역은 남기지 않는다 — 끝낸 것이 아니라 뺀 것이다.
 */
export async function releaseUserQueues(userId: string): Promise<void> {
  const rows = await sql<{ queue_id: string; machine_id: string | null; machine_kind: MachineKind }>`
    SELECT queue_id, machine_id, machine_kind FROM queue WHERE user_id = ${userId}
  `;

  for (const row of rows) {
    await sql`DELETE FROM queue WHERE queue_id = ${row.queue_id}`;
    if (row.machine_id) {
      await freeMachine(row.machine_id);
      await promoteNextWaiter(row.machine_id, row.machine_kind);
    }
  }
}

export async function confirmQr(userId: string, kind: MachineKind): Promise<void> {
  await reconcile();

  const [row] = await sql<QueueRow>`
    SELECT * FROM queue WHERE user_id = ${userId} AND machine_kind = ${kind} AND status = '배정'
  `;
  if (!row || !row.machine_id) throw new QueueError('QR 인증할 배정이 없어요.');

  const deadline = new Date(Date.now() + RUN_MS[kind]);
  await sql`UPDATE queue SET status = '사용중' WHERE queue_id = ${row.queue_id}`;
  await sql`UPDATE machines SET ends_at = ${deadline} WHERE machine_id = ${row.machine_id}`;
}

export async function finishUsage(userId: string, kind: MachineKind): Promise<void> {
  await reconcile();

  const [row] = await sql<QueueRow>`
    SELECT * FROM queue
     WHERE user_id = ${userId} AND machine_kind = ${kind} AND status IN ('사용중', '수거대기')
  `;
  if (!row || !row.machine_id) throw new QueueError('끝낼 이용이 없어요.');

  const [machine] = await sql<{ ends_at: string }>`
    SELECT ends_at FROM machines WHERE machine_id = ${row.machine_id}
  `;
  const endedAt = machine.ends_at ? new Date(machine.ends_at) : new Date();
  const startedAt = new Date(endedAt.getTime() - RUN_MS[kind]);
  const finishedEarly = new Date() < endedAt;

  await sql`DELETE FROM queue WHERE queue_id = ${row.queue_id}`;
  await sql`
    INSERT INTO usage_history (user_id, machine_id, started_at, ended_at, result)
    VALUES (${row.user_id}, ${row.machine_id}, ${startedAt}, ${finishedEarly ? new Date() : endedAt}, '완료')
  `;
  await freeMachine(row.machine_id);
  await promoteNextWaiter(row.machine_id, kind);
}

// ---------------------------------------------------------------------------
// 홈 화면이 읽는 값 (F1)
// ---------------------------------------------------------------------------

export type HomeMachine = Machine & { mine: boolean };

export type HomeTypeSummary = {
  kind: MachineKind;
  total: number;
  available: number;
  inuse: number;
  waiting: number;
  restricted: boolean;
  restrictedUntil: string | null;
  myQueue: QueueRow | null;
  /** 내가 대기 중일 때, 내 앞에 몇 명이 있는지 (P2 — 저장하지 않는 파생값) */
  aheadCount: number;
};

export async function getHomeData(userId: string) {
  await reconcile();

  const machines = await sql<Machine>`SELECT * FROM machines ORDER BY kind, name`;
  const myQueue = await sql<QueueRow>`SELECT * FROM queue WHERE user_id = ${userId}`;
  const { restrictedUntil } = await getRestriction(userId);

  const homeMachines: HomeMachine[] = machines.map((m) => ({
    ...m,
    mine: myQueue.some((q) => q.machine_id === m.machine_id),
  }));

  const typeSummaries: HomeTypeSummary[] = await Promise.all(
    KINDS.map(async (kind) => {
      const list = machines.filter((m) => m.kind === kind);
      const available = list.filter((m) => m.status === '사용가능').length;
      const inuse = list.length - available;
      const [{ n: waiting }] = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM queue WHERE machine_kind = ${kind} AND status = '대기 중'
      `;
      const mine = myQueue.find((q) => q.machine_kind === kind) ?? null;
      let aheadCount = 0;
      if (mine?.status === '대기 중') {
        const [{ n }] = await sql<{ n: number }>`
          SELECT count(*)::int AS n FROM queue
           WHERE machine_kind = ${kind} AND status = '대기 중' AND queued_at < ${mine.queued_at}
        `;
        aheadCount = n;
      }
      return {
        kind,
        total: list.length,
        available,
        inuse,
        waiting: available > 0 ? 0 : waiting,
        restricted: !!restrictedUntil,
        restrictedUntil: restrictedUntil ? restrictedUntil.toISOString() : null,
        myQueue: mine,
        aheadCount,
      };
    }),
  );

  return { machines: homeMachines, typeSummaries };
}
