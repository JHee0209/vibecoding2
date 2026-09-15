# 웹/앱 푸시(Web Push) 기능 구현 및 iOS·Android 실행 가이드

## 작업 요약
기존 UI 디자인과 색상 토큰을 **100% 그대로 유지**하면서, 웹 브라우저 및 스마트폰(Android 및 iOS) 환경 모두에서 실제 백그라운드 푸시 알림을 수신할 수 있도록 전체 파이프라인을 완성하고 테스트 가능한 상태로 가동했습니다.

---

## 주요 변경 사항

### 1. PWA Web App Manifest 및 모바일 메타데이터 구성 (iOS · Android 공통)
- [manifest.ts](file:///c:/project01/src/app/manifest.ts): 앱 이름, 아이콘(`logo-mark.png`), `display: 'standalone'`, 테마 색상 설정. Next.js 16 라우트(`GET /manifest.webmanifest`)로 서빙.
- [layout.tsx](file:///c:/project01/src/app/layout.tsx): `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` 및 viewport 설정 완료.

### 2. iOS Safari 및 Android 푸시 구독 처리
- [src/lib/push-client.ts](file:///c:/project01/src/lib/push-client.ts):
  - `isIos()`, `isStandalone()` 환경 판별 추가.
  - `enablePush()`: 기존 구독 재활용 및 서비스 워커 준비(`ready`) 대기 보완.
  - `syncPushSubscription()`: 이미 알림을 허용한 기기 재방문 시 구독 정보가 유실되지 않도록 백그라운드 자동 동기화.
  - `useSyncExternalStore`를 통한 React 19 호환 외부 상태 구독.
- [src/app/home/notification-prompt.tsx](file:///c:/project01/src/app/home/notification-prompt.tsx):
  - 기존 디자인(컨테이너, 둥근 모서리, 패딩, 테두리, 버튼)을 전혀 바꾸지 않고 유지.
  - **Android / PC 브라우저**: 홈 진입 시 "차례가 되면 알려드릴게요" -> "허용하기" 버튼 클릭 시 브라우저 알림 권한 획득 및 서비스 워커 구독 저장.
  - **iOS Safari 브라우저 탭**: iOS는 정책상 Safari 탭에서 웹 푸시가 차단되므로, "홈 화면에 추가(공유 -> 홈 화면에 추가)하면 알림을 받을 수 있어요" 안내를 기존 배너 디자인 그대로 표시.
  - **iOS 홈 화면 PWA**: 앱으로 실행 시 "허용하기" 클릭으로 푸시 등록 완료.

### 3. 백그라운드 타이머 및 푸시 발송 파이프라인
- [src/lib/scheduler.ts](file:///c:/project01/src/lib/scheduler.ts): 사용자가 웹페이지를 보고 있지 않거나 닫아둔 상태에서도 세탁 종료 및 배정 만료를 감지할 수 있도록 30초 주기 백그라운드 스케줄러 구성.
- [src/instrumentation.ts](file:///c:/project01/src/instrumentation.ts) 및 [src/app/home/page.tsx](file:///c:/project01/src/app/home/page.tsx): 서버 기동 시 스케줄러 자동 시작.
- [src/lib/queue.ts](file:///c:/project01/src/lib/queue.ts): 빈 기기가 있어 즉시 배정(`free`)되는 케이스에도 알림함 기록과 백그라운드 푸시가 누락 없이 발송되도록 연동.
- [src/app/api/push/test/route.ts](file:///c:/project01/src/app/api/push/test/route.ts): 로그인된 사용자 기기로 즉시 테스트 푸시를 쏠 수 있는 개발/확인용 API 라우트 추가.

---

## 검증 결과

1. **TypeScript & ESLint 검증**:
   - `npx eslint src` 실행 결과: 0 errors, 0 warnings 통과.
2. **Next.js Production Build**:
   - `npm run build` 실행 결과: `/manifest.webmanifest`, `/api/push/test` 등 28개 라우트 정상 컴파일 완료.
3. **PWA 매니페스트 및 서비스 워커 서빙**:
   - `http://localhost:3000/manifest.webmanifest` (HTTP 200 OK)
   - `http://localhost:3000/sw.js` (HTTP 200 OK)

---

## 사용자가 직접 푸시 기능을 테스트하는 방법

### 1단계: 로그인
1. 브라우저에서 `http://localhost:3000/login` 접속
2. 테스트 계정으로 로그인:
   - **아이디**: `test@g.eulji.ac.kr`
   - **비밀번호**: `test1234`

### 2단계: 알림 허용
- 홈 화면(`http://localhost:3000/home`) 하단에 뜨는 배너에서 **[허용하기]** 클릭
- 브라우저 팝업에서 **[알림 허용]** 선택
- 이제 브라우저의 푸시 구독 정보가 서버 DB(`push_subscriptions`)에 자동 저장됩니다.

### 3단계: 푸시 수신 확인 (2가지 방법)
- **방법 A (즉시 푸시 테스트)**:
  터미널에서 아래 명령을 실행하면 브라우저/기기로 즉시 푸시 알림이 뜹니다:
  ```powershell
  npm run dev:push
  ```
  *(또는 브라우저 콘솔에서 `fetch('/api/push/test', { method: 'POST' })` 실행)*
- **방법 B (실제 이벤트 푸시)**:
  - 세탁기/건조기 줄서기 배정 또는 사용 종료 타이머 만료 시 브라우저/앱을 백그라운드로 내려두어도 폰 및 OS 알림 센터로 푸시가 자동 전송됩니다.

