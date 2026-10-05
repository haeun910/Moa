import { useState } from 'react';
import { X, Sparkles, CalendarDays, Flag, Package, AlertCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface Step {
  Icon: typeof Sparkles;
  color: string;
  title: string;
  lines: string[];
}

const STEPS: Step[] = [
  {
    Icon: Sparkles, color: 'text-leaf-600 bg-leaf-100 dark:bg-leaf-900/40',
    title: '모아에 오신 걸 환영해요',
    lines: [
      '할 일, 일정, 목표, D-Day를 한 곳에 모아 관리하는 플래너예요.',
      '1분이면 둘러볼 수 있어요. 언제든 설정 > 사용 가이드에서 다시 볼 수 있어요.',
    ],
  },
  {
    Icon: CalendarDays, color: 'text-leaf-600 bg-leaf-100 dark:bg-leaf-900/40',
    title: '홈 — 달력에서 날짜를 눌러보세요',
    lines: [
      '그 날의 D-Day · 일정 · 할 일이 한눈에 보여요.',
      '아래 입력창에서 카테고리 → 하위카테고리(또는 미정)를 고르고 할 일을 적으면 바로 추가돼요.',
      '"상세" 버튼을 누르면 시간, 마감일, 반복(매일·매주·매월)까지 설정할 수 있어요.',
    ],
  },
  {
    Icon: Flag, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
    title: '목표 · D-Day · 일정',
    lines: [
      '홈 위쪽 카드에서 이번 달 목표, D-Day, 일정을 추가할 수 있어요.',
      '일정은 수업 시간표나 정기 회의처럼 요일을 골라 반복할 수 있어요.',
      '반복으로 만든 항목은 "이 항목만 / 이후 모두 / 전체"를 골라 한꺼번에 고칠 수 있어요.',
    ],
  },
  {
    Icon: Package, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    title: '저장소 — 언젠가 할 일 보관함',
    lines: [
      '아직 날짜를 정하지 않은 할 일은 저장소에 모아두세요.',
      '카테고리와 하위카테고리로 정리하고, 할 날이 정해지면 오늘이나 원하는 날짜로 보내면 돼요.',
    ],
  },
  {
    Icon: AlertCircle, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    title: '밀린 할 일도 놓치지 않게',
    lines: [
      '홈의 주황색 ! 버튼을 누르면 지난 날짜에 못 끝낸 할 일이 모여 있어요.',
      '하나씩 또는 한 번에 오늘로 옮길 수 있어요. 옆의 막대 그래프 버튼은 성취 리포트예요.',
    ],
  },
  {
    Icon: Settings, color: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
    title: '마지막으로',
    lines: [
      '설정 > 앱 다운로드로 홈 화면에 추가하면 앱처럼 쓸 수 있어요.',
      '폰과 PC에서 같은 계정으로 로그인하면 자동으로 동기화돼요.',
      '불편한 점이나 원하는 기능은 설정 > 의견 보내기로 알려주세요!',
    ],
  },
];

// 처음 사용하는 사람을 위한 짧은 안내 (여러 장을 넘겨보는 형식)
export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const { Icon, color, title, lines } = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-sm" role="dialog" aria-label="사용 가이드">
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4">
          <span className="text-[11px] font-semibold text-gray-400">{step + 1} / {STEPS.length}</span>
          <button onClick={onClose} aria-label="가이드 닫기"
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-0.5">
            건너뛰기 <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2 text-center">
          <div className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 ${color}`}>
            <Icon size={26} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
          <div className="space-y-2 text-left">
            {lines.map(line => (
              <p key={line} className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{line}</p>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-center gap-1.5 py-3">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} aria-label={`${i + 1}번째 안내`}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-leaf-500' : 'w-1.5 bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>

        <div className="flex-shrink-0 flex gap-2 px-5 pb-5">
          {step > 0 && (
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
