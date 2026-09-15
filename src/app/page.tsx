/**
 * 아직 만들지 않았다.
 * 만드는 순서는 docs/PRD.md 5절 「제작 순서」를 따른다.
 * 화면 목록 · 흐름표는 docs/07-screens.md, 디자인 원본은 docs/design/*.dc.html 이다.
 */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[var(--screen-width)] flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-black text-primary-strong">Washed</h1>
      <p className="text-sm text-primary-strong">기숙사 세탁기 · 건조기 원격 줄서기</p>
      <p className="text-md">docs/PRD.md 를 읽고 5절 「제작 순서」부터 시작한다.</p>
    </main>
  );
}
