// monitoring.ts가 필요할 때만 불러오는 Sentry 부분. 쓰는 함수만 가져와야 번들이 작아짐
// (패키지 전체를 import()하면 쓰지 않는 기능까지 모두 들어가 3배 가까이 커짐)
export { init, captureException, setUser } from '@sentry/react';
