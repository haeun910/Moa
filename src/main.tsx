import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isSaveErrorHandled } from './lib/toast'
import { initMonitoring, reportError } from './lib/monitoring'
import ErrorBoundary from './components/ErrorBoundary'

initMonitoring()

// 저장 실패는 이미 화면에 알림으로 보여줬으므로 "처리 안 된 오류"로 한 번 더 기록하지 않음
window.addEventListener('unhandledrejection', e => {
  if (isSaveErrorHandled(e.reason)) e.preventDefault()
  else reportError(e.reason, 'unhandled rejection')
})
window.addEventListener('error', e => reportError(e.error ?? e.message, 'uncaught error'))

// iOS Safari는 viewport의 user-scalable=no를 무시하고 두 손가락 확대를 허용하므로 직접 막음
// (gesture* 이벤트는 iOS Safari에만 있음)
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false })
}
// 여러 손가락 터치로 확대하는 경우(일부 브라우저)도 막음
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault()
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
