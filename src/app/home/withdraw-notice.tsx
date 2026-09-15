'use client';

// 탈퇴 대기 복구 안내 (F36 · 05 P24 · 07 흐름표 60줄).
// 14일 안에는 되돌릴 수 있고, 그 동안에는 홈 대신 이 화면을 본다.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function WithdrawNotice({ daysLeft }: { daysLeft: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelWithdraw() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/account/withdraw', { method: 'DELETE' });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? '되돌리지 못했어요.');
        return;
      }
      router.refresh();
    } catch {
      setError('네트워크 오류예요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-black text-text">탈퇴 신청을 받았어요</h1>
      <p className="text-sm leading-relaxed text-text/60">
        {daysLeft}일 안에 되돌리면 계정이 그대로 살아나요.
        <br />
        기간이 지나면 이용 내역 · 경고 · 신고 기록이 모두 영구 삭제됩니다.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={cancelWithdraw}
        disabled={pending}
        className="mt-2 h-[var(--control-height)] w-full rounded-md bg-primary px-6 text-base font-bold text-surface disabled:opacity-60"
      >
        {pending ? '처리 중…' : '탈퇴 취소하고 계속 쓰기'}
      </button>
    </div>
  );
}
