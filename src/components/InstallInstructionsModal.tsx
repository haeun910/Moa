import { X, Share, Menu, MonitorSmartphone } from 'lucide-react';

function detectPlatform(): 'ios' | 'ios-non-safari' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return isSafari ? 'ios' : 'ios-non-safari';
  }
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export default function InstallInstructionsModal({ onClose }: { onClose: () => void }) {
  const platform = detectPlatform();

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const steps: { Icon: typeof Share; text: string }[] =
    platform === 'ios' ? [
      { Icon: Share, text: 'Safari 하단(또는 상단)의 공유 아이콘을 눌러주세요' },
      { Icon: MonitorSmartphone, text: '아래로 스크롤해서 "홈 화면에 추가"를 선택하세요' },
    ] : platform === 'ios-non-safari' ? [
      { Icon: MonitorSmartphone, text: 'iOS에서는 Safari 브라우저에서만 설치할 수 있어요' },
      { Icon: Share, text: 'Safari로 이 페이지를 연 뒤, 공유 아이콘 → "홈 화면에 추가"를 눌러주세요' },
    ] : platform === 'android' ? [
      { Icon: Menu, text: '브라우저 오른쪽 위 메뉴(⋮)를 눌러주세요' },
      { Icon: MonitorSmartphone, text: '"앱 설치" 또는 "홈 화면에 추가"를 선택하세요' },
    ] : [
      { Icon: MonitorSmartphone, text: '주소창 오른쪽의 설치 아이콘을 클릭하세요' },
      { Icon: Menu, text: '안 보이면 브라우저 메뉴 → "앱 설치"를 선택하세요 (Chrome/Edge에서 지원돼요)' },
    ];

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal-panel max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">앱 설치 방법</h2>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-leaf-100 dark:bg-leaf-900/40 flex items-center justify-center flex-shrink-0">
                <step.Icon size={15} className="text-leaf-600" />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-1">{step.text}</p>
            </div>
          ))}
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 text-white text-sm font-semibold transition-colors mt-2">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
