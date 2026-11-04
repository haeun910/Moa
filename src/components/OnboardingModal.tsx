import { useMemo, useState } from 'react';
import { X, Sparkles, Home, CalendarDays, Package, AlertCircle, NotebookPen, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useApp } from '../context/AppContext';
import { isPushConfigured } from '../lib/push';

interface Step {
  Icon: typeof Sparkles;
  title: string;
  lines: string[];
}

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// 지금 화면(폰·태블릿 하단 탭 / PC 왼쪽 메뉴)과 설정에서 켠 기능에 맞춰 안내 문구를 만듦
function buildSteps(desktop: boolean, hidden: Set<string>): Step[] {
  const timebox = !hidden.has('timebox');
  const storage = !hidden.has('all');
  const notes = !hidden.has('notes');
  const steps: (Step | false)[] = [
    {
      Icon: Sparkles,
      title: '모아에 오신 걸 환영해요',
      lines: [
        `할 일, 일정, D-Day, 목표${notes ? ', 메모' : ''}를 한 곳에 모아 관리하는 플래너예요.`,
        desktop
          ? '왼쪽 메뉴에서 홈 · 달력' + (timebox ? ' · 타임박스' : '') + (storage ? ' · 저장소' : '') + (notes ? ' · 메모' : '') + ' · 설정으로 이동해요.'
          : '화면 아래 홈 · 달력' + (notes ? ' · 메모' : '') + ' · 설정 탭으로 이동해요.',
        '1분이면 둘러볼 수 있어요. 설정 > 사용 가이드에서 언제든 다시 볼 수 있어요.',
      ],
    },
    {
      Icon: Home,
      title: '홈 — 오늘을 한눈에',
      lines: [
        '오늘 할 일, 오늘 일정, 다가오는 D-Day, 밀린 일이 홈에 모여 있어요.',
        '"오늘 할 일" 아래 칸에 적으면 바로 추가돼요. 지난번에 고른 카테고리가 미리 정해져 있고, "바꾸기"로 바꿀 수 있어요.',
        `"상세"를 누르면 시간, 마감일, 반복(매일·매주·매월)${isPushConfigured ? ', 미리 알림' : ''}까지 정할 수 있어요.`,
      ],
    },
    {
      Icon: CalendarDays,
      title: '달력 — 날짜를 눌러 보세요',
      lines: [
        desktop
          ? `"달력"에서 월 · 주 단위로 보고${timebox ? ', "타임박스"에서 하루를 시간 단위로 계획해요' : ' 계획해요'}.`
          : `"달력" 탭 위에서 월 · 주${timebox ? ' · 타임박스' : ''} 보기를 바꿀 수 있어요.`,
        '날짜를 누르면 그날의 할 일 · 일정 · D-Day가 열리고 바로 추가할 수 있어요.',
        '월 달력 칸에는 할 일 제목 대신 하위 카테고리 이름(없으면 카테고리 이름)이 보여요.',
        '수업이나 정기 회의처럼 반복되는 일정은 반복으로 만들고, 고칠 때 "이 항목만 / 이후 모두 / 전체"를 고르면 돼요.',
      ],
    },
    storage && {
      Icon: Package,
      title: '저장소 — 언젠가 할 일 보관함',
      lines: [
        `아직 날짜를 정하지 않은 할 일은 저장소에 모아 두세요. ${desktop ? '왼쪽 메뉴의 "저장소"' : '홈 맨 위의 "저장소" 버튼'}으로 들어가요.`,
        '할 날이 정해지면 오늘이나 원하는 날짜로 보내면 돼요.',
        '카테고리는 저장소 위의 "카테고리 관리"에서 만들고 고칠 수 있어요.',
      ],
    },
    {
      Icon: AlertCircle,
      title: '밀린 일은 가볍게 정리',
      lines: [
        '지난 날짜에 못 끝낸 할 일은 "밀린 일"에 모여요. 홈의 밀린 일 칸이나 달력 위 버튼으로 열어요.',
        '"오늘로" 옮기거나, 하지 않을 일은 "안 하기"로 정리하세요. 2주가 지난 일은 "오래된 할 일"로 따로 접어 둬요.',
        '반복 할 일은 가장 최근에 놓친 한 번만 보여서 쌓이지 않아요.',
      ],
    },
    {
      Icon: NotebookPen,
      title: notes ? '메모와 검색' : '검색',
      lines: [
        ...(notes ? ['메모는 쓰는 대로 자동 저장돼요. # 제목, - 목록, - [ ] 체크리스트, **굵게**를 쓸 수 있고 주소를 붙여 넣으면 링크가 돼요.'] : []),
        desktop
          ? `왼쪽 메뉴의 "검색"이나 ${MAC ? '⌘K' : 'Ctrl+K'}로 할 일 · 일정${notes ? ' · 메모' : ''}를 한 번에 찾아요.`
          : `홈 · 달력 · 저장소 위의 돋보기로 할 일 · 일정${notes ? ' · 메모' : ''}를 한 번에 찾아요.`,
        '"ㅂㄱㅅ"처럼 초성만 적어도 "보고서"를 찾아요.',
      ],
    },
    {
      Icon: Settings,
      title: '마지막으로',
      lines: [
        '설정 > 앱 다운로드로 홈 화면에 추가하면 앱처럼 쓸 수 있어요.',
        '인터넷이 끊겨도 적은 내용은 이 기기에 보관했다가, 다시 연결되면 자동으로 저장돼요.',
        '폰과 PC에서 같은 계정으로 로그인하면 내용이 똑같이 맞춰져요.',
        '불편한 점이나 원하는 기능은 설정 > 의견 보내기로 알려주세요.',
      ],
    },
  ];
  return steps.filter((s): s is Step => !!s);
}

// 처음 사용하는 사람을 위한 짧은 안내 (여러 장을 넘겨보는 형식)
export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { settings } = useApp();
  const STEPS = useMemo(() => buildSteps(desktop, new Set(settings.hiddenFeatures)), [desktop, settings.hiddenFeatures]);
  const [step, setStep] = useState(0);
  const current = Math.min(step, STEPS.length - 1);
  const isLast = current === STEPS.length - 1;

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-sm" role="dialog" aria-label="사용 가이드">
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4">
          <span className="text-11px font-semibold text-gray-400">{current + 1} / {STEPS.length}</span>
          <button onClick={onClose} aria-label="가이드 닫기"
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-0.5">
            건너뛰기 <X size={13} />
          </button>
        </div>

        {/* 모든 단계를 같은 칸에 겹쳐 두고 지금 단계만 보여줌 → 단계마다 창 높이가 들쭉날쭉하지 않음 */}
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2 text-center grid">
          {STEPS.map(({ Icon, title, lines }, i) => (
            <div key={title} className={`[grid-area:1/1] ${i === current ? '' : 'invisible'}`} aria-hidden={i !== current}>
              <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 text-leaf-600 bg-leaf-100 dark:text-leaf-400 dark:bg-leaf-900/40">
                <Icon size={26} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
              <div className="space-y-2 text-left">
                {lines.map(line => (
                  <p key={line} className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 flex justify-center gap-1.5 py-3">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} aria-label={`${i + 1}번째 안내`}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-leaf-500' : 'w-1.5 bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>

        <div className="flex-shrink-0 flex gap-2 px-5 pb-5">
          {current > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center justify-center gap-0.5 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium">
              <ChevronLeft size={15} /> 이전
            </button>
          )}
          <button onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            className="flex-1 flex items-center justify-center gap-0.5 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 text-white text-sm font-semibold">
            {isLast ? '시작하기' : <>다음 <ChevronRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
