// 개발용 테스트 계정 하나 만들기 — 실행: npm run dev:user
//
// 왜 필요한가: 푸시 구독은 06 「푸시 구독」의 "누가" 칸(user_id)이 반드시 있어야
// 저장된다. 그런데 회원가입 화면(F14 · F15)은 아직 만들지 않았다. 그래서 화면 없이
// users 표에 한 명만 직접 넣는다.
//
// **이 파일은 개발 전용이다.** 회원가입 화면이 생기면 지워도 된다.
// 비밀번호 해시 형태는 src/lib/hash.ts 와 똑같이 맞췄다(scrypt$N$r$p$salt$hash) —
// 그래야 로그인(F38)이 이 계정을 알아본다.

import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

import pg from 'pg';

import { strictSsl } from './strict-ssl.mjs';

const scrypt = promisify(scryptCb);

// src/lib/hash.ts 의 PARAMS 와 같은 값이어야 한다.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

async function hash(plain) {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 32, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

// ---------------------------------------------------------------------------
// 여기만 고쳐 쓰면 된다. 이메일은 05 P11 대로 ac.kr 로 끝나야 하고,
// 비밀번호는 8자 이상, 학번은 숫자만 12자리까지다.
// ---------------------------------------------------------------------------
const TEST_USER = {
  name: '테스트',
  email: 'test@g.eulji.ac.kr',
  password: 'test1234',
  gender: '여',
  school: '을지대학교',
  studentId: '20250001',
  room: '101',
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('\n.env.local 에 DATABASE_URL 이 없습니다.\n');
  process.exit(1);
}

const client = new pg.Client({ connectionString: strictSsl(connectionString) });

try {
  await client.connect();

  const passwordHash = await hash(TEST_USER.password);

  // 이미 있으면 비밀번호만 다시 맞춘다 — 몇 번을 돌려도 탈이 없게
  // (05 P11 — 아이디가 같으면 같은 계정이다. 계정을 새로 만들지 않는다).
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, signup_method, gender, school, student_id, room)
     VALUES ($1, $2, $3, '이메일', $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING user_id, email`,
    [
      TEST_USER.name,
      TEST_USER.email,
      passwordHash,
      TEST_USER.gender,
      TEST_USER.school,
      TEST_USER.studentId,
      TEST_USER.room,
    ],
  );

  console.log('\n테스트 계정이 준비됐습니다.');
  console.log('  이메일   :', rows[0].email);
  console.log('  비밀번호 :', TEST_USER.password);
  console.log('  user_id  :', rows[0].user_id);
  console.log('\nhttp://localhost:3000/login 에서 이 계정으로 로그인하세요.\n');
} catch (error) {
  console.error('\n실패했습니다:', error.message, '\n');
  process.exitCode = 1;
} finally {
  await client.end();
}
