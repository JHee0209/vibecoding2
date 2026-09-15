'use client';

// F40 — 로그인 뒤 홈 첫 진입에서 폰 알림 허용 받기 (05 P26 · 07-screens.md 51 · 115줄)
//
// "허용을 한 번만 묻는다" 는 06 에 저장 칸이 없어 기기 단위로 남긴다 —
// 언어 설정(washed_lang)과 같은 방식으로 localStorage 에 물어봤다는 표시만 둔다.
// 실제 허용 여부는 브라우저의 Notification.permission 이 이미 기억하고 있으므로
// 서버에는 "허용했는지" 가 아니라 "구독 정보가 있는지" 만 남는다(06 「푸시 구독」).
//
// 거절해도 앱은 그대로 쓴다(P26). 다시 켜는 자리는 설정 화면의 "알림이 꺼져 있어요" 줄이다.
// 아이폰 홈 화면 추가 안내(F41)는 여기서 다루지 않는다 — 아직 만들지 않았다.

import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  askedServerSnapshot,
  askedSnapshot,
  enablePush,
  iosNeedsInstallServerSnapshot,
  iosNeedsInstallSnapshot,
  markAsked,
  permissionServerSnapshot,
  permissionSnapshot,
  subscribePushState,
  syncPushSubscription,
} from '@/lib/push-client';

export function NotificationPrompt() {
  const [pending, setPending] = useState(false);

  const permission = useSyncExternalStore(
    subscribePushState,
    permissionSnapshot,
    permissionServerSnapshot,
  );
  const asked = useSyncExternalStore(subscribePushState, askedSnapshot, askedServerSnapshot);
  const iosNeedsInstall = useSyncExternalStore(
    subscribePushState,
    iosNeedsInstallSnapshot,
    iosNeedsInstallServerSnapshot,
  );

  useEffect(() => {
    // 이미 허용한 기기라면 서버에 구독 정보가 유지되도록 백그라운드 동기화
    if (permission === 'granted') {
      syncPushSubscription();
    }
  }, [permission]);

  async function allow() {
    setPending(true);
    try {
      await enablePush();
    } catch (error) {
      console.error('알림 등록 실패', error);
    } finally {
      markAsked();
      setPending(false);
    }
  }

  // 이미 물어봤으면 표시하지 않는다
  if (asked) return null;

  // iOS Safari 브라우저에서 열었을 경우: 홈 화면 추가 가이드 (디자인 유지)
  if (iosNeedsInstall) {
    return (
      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto flex w-full max-w-[var(--screen-width)] flex-col gap-2 rounded-t-lg border-t border-primary-soft bg-surface p-4">
        <p className="text-base font-bold text-text">홈 화면에 추가하면 알림을 받을 수 있어요</p>
        <p className="text-sm text-text">
          Safari 하단의 <strong>공유(아이콘)</strong>를 누르고 <strong>&apos;홈 화면에 추가&apos;</strong>하면 배정 및 종료 푸시 알림을 받을 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={markAsked}
            className="h-[var(--control-height)] flex-1 rounded-md bg-primary text-base font-bold text-surface"
          >
            확인했어요
          </button>
        </div>
      </div>
    );
  }

  // 브라우저가 이미 허용 · 거절을 기억하고 있으면 묻지 않는다.
  if (permission !== 'default') return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-10 mx-auto flex w-full max-w-[var(--screen-width)] flex-col gap-2 rounded-t-lg border-t border-primary-soft bg-surface p-4">
      <p className="text-base font-bold text-text">차례가 되면 알려드릴게요</p>
      <p className="text-sm text-text">
        배정 · 종료 알림을 폰 알림으로 받을 수 있어요. 거절해도 앱은 그대로 쓸 수 있어요.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={markAsked}
          className="h-[var(--control-height)] flex-1 rounded-md border border-primary-soft text-base font-medium text-text"
        >
          나중에
        </button>
        <button
          type="button"
          onClick={allow}
          disabled={pending}
          className="h-[var(--control-height)] flex-1 rounded-md bg-primary text-base font-bold text-surface disabled:opacity-60"
        >
          {pending ? '등록 중…' : '허용하기'}
        </button>
      </div>
    </div>
  );
}
