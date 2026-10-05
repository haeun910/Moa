import { ChevronLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

// 표준 템플릿입니다. 실제 서비스로 정식 운영하기 전에 변호사 등 전문가 검토를 받으세요.
export default function TermsPage() {
  const { setCurrentScreen } = useApp();

  return (
    <div className="min-h-screen pb-24 lg:pb-12">
      <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 lg:px-8 pt-8 sm:pt-10 pb-5">
        <button onClick={() => setCurrentScreen('settings')} aria-label="설정으로 돌아가기"
          className="btn-icon w-9 h-9 -ml-2">
          <ChevronLeft size={20} />
        </button>
        <h1 className="page-title text-[22px] flex-1">이용약관</h1>
      </div>

      <div className="px-4 lg:px-8 pb-10 max-w-2xl mx-auto"><div className="rounded-xl surface px-5 sm:px-7 py-6 space-y-6 text-sm text-gray-600 dark:text-gray-400 leading-[1.75]">
        <p className="text-xs text-gray-400 dark:text-gray-500">최종 수정일: 2026년 9월 8일</p>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">제1조 (목적)</h2>
          <p>이 약관은 모아(이하 "서비스")의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">제2조 (서비스의 제공)</h2>
          <p>서비스는 할 일 관리, 일정 관리, 메모 작성 등의 기능을 무료로 제공합니다. 서비스 제공자는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">제3조 (이용자의 의무)</h2>
          <p>이용자는 서비스 이용 시 관계 법령, 이 약관의 규정을 준수해야 하며, 타인의 계정을 도용하거나 서비스를 부정한 목적으로 사용해서는 안 됩니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">제4조 (콘텐츠의 소유)</h2>
          <p>이용자가 서비스에 등록한 할 일, 메모 등 콘텐츠의 저작권은 해당 이용자에게 있습니다. 서비스 제공자는 서비스 운영 목적 범위 내에서만 이를 저장·처리합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">제5조 (면책조항)</h2>
          <p>서비스는 무료로 제공되며, 천재지변, 서비스 장애, 데이터 유실 등에 대해 서비스 제공자는 관련 법령이 허용하는 한도 내에서 책임을 지지 않습니다. 중요한 데이터는 설정의 "데이터 내보내기" 기능으로 주기적으로 백업하시길 권장합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">제6조 (약관의 변경)</h2>
          <p>이 약관은 서비스 내 공지를 통해 변경될 수 있으며, 변경된 약관은 공지 시점부터 효력이 발생합니다.</p>
        </section>

        <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
          문의사항이 있으시면 설정 화면의 문의하기를 이용해 주세요.
        </p>
        </div>
      </div>
    </div>
  );
}
