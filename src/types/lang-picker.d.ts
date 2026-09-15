// <lang-picker> 는 public/i18n.js(= docs/design/i18n.js)가 정의하는 커스텀 엘리먼트다.
// 언어 버튼(F37 · 05 P25) — 로그인 화면 오른쪽 위와 설정의 「언어」 묶음 두 곳에 들어간다.

import type * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lang-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        /** 설정은 compact, 로그인은 기본 크기 (07 「디자인」 의 「언어 버튼」) */
        variant?: 'compact';
        /** 목록이 펼쳐지는 방향 */
        align?: 'right';
      };
    }
  }
}
