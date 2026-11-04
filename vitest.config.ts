import { defineConfig } from 'vitest/config'

// 단위 테스트 전용 설정 (PWA 플러그인 등 앱 빌드 설정은 필요 없음)
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
