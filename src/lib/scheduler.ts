// 백그라운드 상태 정리 및 푸시 발송 스케줄러 (08-deployNOTE.md 4번)
//
// 앱이 닫혀 있는 사용자에게도 세탁 종료 및 차례 배정 푸시가 정시에 발송되도록,
// 30초마다 queue.ts 의 reconcile() 을 실행한다.

import 'server-only';

import { reconcile } from '@/lib/queue';

const INTERVAL_MS = 30 * 1000;

declare global {
  var __washed_scheduler_started: boolean | undefined;
}

export function startBackgroundScheduler(): void {
  if (globalThis.__washed_scheduler_started) return;
  globalThis.__washed_scheduler_started = true;

  const timer = setInterval(async () => {
    try {
      await reconcile();
    } catch (error) {
      console.error('백그라운드 스케줄러 정리 실패:', error);
    }
  }, INTERVAL_MS);

  // 프로세스 종료 시 인터벌 정리
  if (timer.unref) {
    timer.unref();
  }
}
