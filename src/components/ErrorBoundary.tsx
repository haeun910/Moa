import { Component } from 'react';
import type { ReactNode } from 'react';
import { reportError } from '../lib/monitoring';

// 화면을 그리다 오류가 나면 흰 화면 대신 "새로고침" 안내를 보여주고 오류를 기록함
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportError(error, 'render');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl p-6 text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">화면을 표시하지 못했어요</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
            저장된 데이터는 안전해요. 새로고침하면 대부분 해결돼요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-leaf-600 hover:bg-leaf-700 text-white text-sm font-semibold transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }
}
