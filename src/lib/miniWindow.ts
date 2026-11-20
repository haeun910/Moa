// PC 미니 창: "오늘 할 일"을 다른 프로그램 창 위에 항상 떠 있는 작은 창으로 띄움.
// 브라우저의 Document Picture-in-Picture 기능을 써서 크롬·엣지(컴퓨터)에서만 되고,
// 모아 탭(또는 설치한 앱 창)이 열려 있어야 함 (최소화는 괜찮음). 탭을 닫으면 미니 창도 닫힘.
// 미니 창의 화면은 같은 앱 안에서 그려서(MiniTodayHost의 portal) 체크·추가가 본 창과 바로 같이 바뀜.

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

type Listener = (win: Window | null) => void;

let current: Window | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

function pipApi(): DocumentPictureInPicture | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  return (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture ?? null;
}

// 이 브라우저에서 미니 창을 띄울 수 있는지 (사파리·파이어폭스·휴대폰은 안 됨 → 버튼을 숨김)
export function miniWindowSupported(): boolean {
  return pipApi() !== null;
}

// 본 창의 스타일(tailwind, 글꼴)을 미니 창에도 넣음.
// 같은 주소의 스타일은 규칙을 글자로 옮겨 바로 적용하고(파일을 다시 받지 않아 깜빡임 없음),
// 다른 주소(글꼴 CDN)처럼 규칙을 읽을 수 없는 것만 <link>로 다시 불러옴 (크롬 공식 예제와 같은 방식)
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
      target.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = target.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      if (sheet.media.mediaText) link.media = sheet.media.mediaText;
      target.head.appendChild(link);
    }
  }
}

// 다크 모드(class)와 글자 크기 배율(--fs)을 본 창과 같게
function syncRoot(target: Document) {
  const src = document.documentElement;
  const dst = target.documentElement;
  dst.lang = src.lang;
  dst.className = src.className;
  dst.setAttribute('style', src.getAttribute('style') ?? '');
  // 본 창 위쪽 오프라인 안내 줄 높이는 미니 창에는 해당 없음
  dst.style.setProperty('--strip-h', '0px');
}

export type OpenResult = 'opened' | 'focused' | 'unsupported' | 'failed';

// 버튼을 누른 그 순간에 불러야 함 (브라우저가 사용자가 누른 직후에만 창을 열어 줌)
export async function openMiniWindow(): Promise<OpenResult> {
  const api = pipApi();
  if (!api) return 'unsupported';
  if (current && !current.closed) {
    current.focus();
    return 'focused';
  }
  let pip: Window;
  try {
    pip = await api.requestWindow({ width: 360, height: 560 });
  } catch {
    return 'failed';
  }
  pip.document.title = '모아 · 오늘 할 일';
  copyStyles(pip.document);
  syncRoot(pip.document);
  const observer = new MutationObserver(() => syncRoot(pip.document));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'lang'] });
  pip.addEventListener('pagehide', () => {
    observer.disconnect();
    if (current === pip) {
      current = null;
      emit();
    }
  }, { once: true });
  current = pip;
  emit();
  return 'opened';
}

export function closeMiniWindow() {
  const win = current;
  current = null;
  emit();
  if (win && !win.closed) win.close();
}

export function subscribeMiniWindow(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
