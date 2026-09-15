// 기기 목록을 처음 한 번 채운다.  실행: npm run db:seed
//
// 06 「기기」 표는 실제 세탁실 자산이라 회원가입처럼 화면에서 만들어지지 않는다 —
// 프로토타입(홈.dc.html)의 대수를 그대로 옮긴다: 세탁기 8대 · 건조기 4대.
// 이미 있는 이름은 건드리지 않는다(ON CONFLICT DO NOTHING) — 몇 번을 돌려도 탈이 없다.

import pg from 'pg';

import { strictSsl } from './strict-ssl.mjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('\n.env.local 에 DATABASE_URL 이 없습니다.\n');
  process.exit(1);
}

const MACHINES = [
  ...Array.from({ length: 8 }, (_, i) => ({ name: `세탁기 ${i + 1}호기`, kind: '세탁기' })),
  ...Array.from({ length: 4 }, (_, i) => ({ name: `건조기 ${i + 1}호기`, kind: '건조기' })),
];

const client = new pg.Client({ connectionString: strictSsl(connectionString) });

try {
  await client.connect();

  let inserted = 0;
  for (const m of MACHINES) {
    const { rowCount } = await client.query(
      `INSERT INTO machines (name, kind) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [m.name, m.kind],
    );
    inserted += rowCount;
  }

  const { rows } = await client.query(
    `SELECT kind, count(*)::int AS n FROM machines GROUP BY kind ORDER BY kind`,
  );

  console.log(`\n${inserted}대를 새로 넣었습니다. 지금 기기 목록:`);
  for (const row of rows) console.log(`  · ${row.kind} ${row.n}대`);
  console.log();
} catch (error) {
  console.error('\n실패했습니다:', error.message, '\n');
  process.exitCode = 1;
} finally {
  await client.end();
}
