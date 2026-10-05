import { ChevronLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

// 표준 템플릿입니다. 실제 서비스로 정식 운영하기 전에 변호사 등 전문가 검토를 받으세요.
export default function PrivacyPage() {
  const { setCurrentScreen } = useApp();

  return (
    <div className="min-h-screen pb-24 lg:pb-12">
      <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 lg:px-8 pt-8 sm:pt-10 pb-5">
        <button onClick={() => setCurrentScreen('settings')} aria-label="설정으로 돌아가기"
          className="btn-icon w-9 h-9 -ml-2">
          <ChevronLeft size={20} />
        </button>
        <h1 className="page-title text-[22px] flex-1">개인정보처리방침</h1>
      </div>

      <div className="px-4 lg:px-8 pb-10 max-w-2xl mx-auto"><div className="rounded-xl surface px-5 sm:px-7 py-6 space-y-6 text-sm text-gray-600 dark:text-gray-400 leading-[1.75]">
        <p className="text-xs text-gray-400 dark:text-gray-500">최종 수정일: 2026년 9월 8일</p>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">1. 수집하는 개인정보 항목</h2>
          <p>회원가입 시 이메일 주소, 이름(선택)을 수집합니다. 구글 계정으로 가입할 경우 구글이 제공하는 이메일, 이름, 프로필 사진을 수집할 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">2. 개인정보의 수집 및 이용 목적</h2>
          <p>회원 식별 및 로그인, 할 일·메모·일정 데이터의 저장 및 동기화, 서비스 관련 안내를 위해 이용합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">3. 개인정보의 보유 및 이용 기간</h2>
          <p>회원 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 따라 보존할 의무가 있는 경우 해당 기간 동안 보관합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">4. 개인정보의 저장 및 처리 위탁</h2>
          <p>서비스는 데이터베이스 및 인증 처리를 위해 Supabase(해외 클라우드 인프라)를 이용합니다. 이용자가 입력한 데이터는 Supabase의 서버에 저장되며, 관련 보안 정책은 Supabase의 정책을 따릅니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">5. 이용자의 권리</h2>
          <p>이용자는 언제든지 설정 화면에서 본인의 데이터를 내보내거나(백업), 회원 탈퇴를 통해 본인의 데이터를 삭제할 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">6. 개인정보의 안전성 확보 조치</h2>
          <p>비밀번호는 암호화되어 저장되며, 각 이용자의 데이터는 본인만 접근할 수 있도록 접근 제어(Row Level Security)가 적용되어 있습니다.</p>
        </section>

        <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
          문의사항이 있으시면 설정 화면의 문의하기를 이용해 주세요.
        </p>
        </div>
      </div>
    </div>
  );
}
