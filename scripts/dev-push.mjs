// 저장된 구독에 테스트 알림 하나를 실제로 보내 본다.  실행: npm run dev:push
//
// dev-user.mjs 로 만든 테스트 계정이 브라우저에서 홈 화면의 "허용하기" 를 눌러
// /api/push/subscribe 로 구독을 저장해 두어야 보낼 곳이 생긴다 — 이 스크립트는
// 구독을 만들지 않는다.
//
// **이 파일은 개발 전용이다.** 실제 발송(F5 · F9 · F31 이 알림을 남기는 자리에
// 붙이는 것)은 아직 만들지 않았고, 그때는 이 파일의 로직을 src/lib/push.ts 로
// 옮겨 앱 코드가 함께 쓴다.
//
// 06 「푸시 구독」 · 05 P26: "보내다 성공하면 마지막 성공 시각을 남기고,
// 실패하면(수신자가 구독을 끊었거나 만료됨) 그 줄을 지운다."

import webpush from 'web-push';
import pg from 'pg';

import { strictSsl } from './strict-ssl.mjs';

// dev-user.mjs 의 TEST_USER.email 과 같다. 다른 계정으로 보내려면 여기만 고친다.
const TARGET_EMAIL = 'test@g.eulji.ac.kr';

const { DATABASE_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (!DATABASE_URL) {
  console.error('\n.env.local 에 DATABASE_URL 이 없습니다.\n');
  process.exit(1);
}
if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error(
    '\n.env.local 에 NEXT_PUBLIC_VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT 가 다 있어야 합니다.\n',
  );
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const client = new pg.Client({ connectionString: strictSsl(DATABASE_URL) });

try {
  await client.connect();

  const { rows: users } = await client.query('SELECT user_id FROM users WHERE email = $1', [
    TARGET_EMAIL,
  ]);
  if (users.length === 0) {
    console.error(`\n${TARGET_EMAIL} 계정이 없습니다. 먼저 npm run dev:user 를 실행하세요.\n`);
    process.exit(1);
  }
  const userId = users[0].user_id;

  const { rows: subs } = await client.query(
    'SELECT push_subscription_id, endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );

  if (subs.length === 0) {
    console.error(
      `\n${TARGET_EMAIL} 의 구독이 없습니다.\n` +
        'http://localhost:3000/login 으로 이 계정에 로그인한 뒤, 홈 화면 하단 배너의' +
        ' "허용하기" 를 눌러 알림을 허용해야 구독이 생깁니다.\n',
    );
    process.exit(1);
  }

  const payload = JSON.stringify({
    title: 'Washed',
    body: '테스트 알림이에요 — 배정 · 종료 알림은 이렇게 옵니다.',
    url: '/home',
  });

  let sent = 0;
  let removed = 0;

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
    };

    try {
      await webpush.sendNotification(subscription, payload);
      await client.query(
        'UPDATE push_subscriptions SET last_success_at = now() WHERE push_subscription_id = $1',
        [sub.push_subscription_id],
      );
      sent += 1;
      console.log(`  성공 · ${sub.endpoint.slice(0, 60)}…`);
    } catch (error) {
      // P26 — 보내다 실패한 구독은 지운다 (수신자가 구독을 끊었거나 만료된 경우가 대부분이다).
      await client.query('DELETE FROM push_subscriptions WHERE push_subscription_id = $1', [
        sub.push_subscription_id,
      ]);
      removed += 1;
      console.log(
        `  실패(지움) · ${sub.endpoint.slice(0, 60)}… · ${error.statusCode ?? ''} ${error.body ?? error.message}`,
      );
    }
  }

  console.log(`\n${subs.length}개 중 성공 ${sent}개 · 실패해서 지운 것 ${removed}개.\n`);
} catch (error) {
  console.error('\n실패했습니다:', error.message, '\n');
  process.exitCode = 1;
} finally {
  await client.end();
}
