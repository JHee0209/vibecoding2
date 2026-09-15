// 개발 및 동작 확인용: 현재 로그인된 사용자 기기로 테스트 푸시 발송
// POST /api/push/test

import { auth } from '@/auth';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  try {
    await notify(
      userId,
      '배정',
      'Washed 알림 테스트',
      '푸시 알림이 정상적으로 수신되었습니다! (차례 배정 및 이용 종료 알림도 동일하게 전송됩니다)',
    );
    return Response.json({ ok: true, message: '테스트 푸시가 발송되었습니다.' });
  } catch (error) {
    console.error('테스트 푸시 발송 실패:', error);
    return Response.json({ ok: false, message: '푸시 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

