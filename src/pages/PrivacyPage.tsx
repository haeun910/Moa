import { ChevronLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PRIVACY_OFFICER, PRIVACY_UPDATED_AT, SUPABASE_REGION } from '../data/legal';

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
        <p className="text-xs text-gray-400 dark:text-gray-500">최종 수정일: {PRIVACY_UPDATED_AT}</p>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">1. 수집하는 개인정보 항목</h2>
          <p>회원가입 시 이메일 주소, 이름(선택)을 수집합니다. 구글 계정으로 가입할 경우 구글이 제공하는 이메일, 이름, 프로필 사진을 수집할 수 있습니다.</p>
          <p className="mt-1.5">서비스 이용 과정에서 이용자가 직접 입력한 할 일, 일정, 목표, D-Day, 메모, 타임박스, 설정 정보가 저장됩니다. "의견 보내기"를 이용하는 경우 작성한 의견 내용과 앱 버전이 저장됩니다.</p>
          <p className="mt-1.5">타임박스 알림을 켠 경우, 알림을 보내기 위해 해당 기기의 알림 수신 주소(웹 푸시 구독 정보), 기기 시간대, 브라우저 종류 정보(User-Agent)가 저장됩니다. 알림을 끄면 해당 기기의 정보는 삭제됩니다.</p>
          <p className="mt-1.5">앱 오류가 발생하면 문제 해결을 위해 오류 내용, 앱 버전, 브라우저 종류, 이용자 식별번호(무작위로 만든 계정 ID)가 오류 수집 서비스로 전송될 수 있습니다. 이메일 주소와 이용자가 입력한 내용은 전송하지 않습니다.</p>
          <p className="mt-1.5">사용 가이드 확인 여부 등 편의 기능을 위한 일부 설정은 이용자의 기기(브라우저 저장소)에만 저장되며 서버로 전송되지 않습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">2. 개인정보의 수집 및 이용 목적</h2>
          <p>회원 식별 및 로그인, 할 일·메모·일정 데이터의 저장 및 여러 기기 간 동기화, 타임박스 알림 발송, 서비스 관련 안내, 오류 확인 및 해결, 이용자 의견을 통한 서비스 개선을 위해 이용합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">3. 개인정보의 보유 및 이용 기간</h2>
          <p>회원 탈퇴 시 로그인 계정 정보와 이용자가 입력한 모든 데이터(보낸 의견, 알림 수신 정보 포함)를 지체 없이 파기합니다. 오류 수집 서비스에 전송된 오류 기록은 최대 90일 보관 후 자동 삭제됩니다. 단, 관계 법령에 따라 보존할 의무가 있는 경우 해당 기간 동안 보관합니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">4. 개인정보 처리의 위탁 및 국외 이전</h2>
          <p>서비스는 아래 업체에 개인정보 처리를 맡기고 있으며, 이 과정에서 개인정보가 국외로 이전될 수 있습니다. 개인정보는 서비스를 이용하는 시점에 암호화된 네트워크(HTTPS)를 통해 전송되며, 회원 탈퇴 시까지 보관됩니다.</p>
          <ul className="mt-2 space-y-2 list-disc pl-5">
            <li>
              <b className="text-gray-800 dark:text-gray-200">Supabase Inc.</b> (미국) · 데이터베이스 저장 및 로그인 처리
              {SUPABASE_REGION ? ` · 데이터 저장 위치: ${SUPABASE_REGION}` : ''}
              <br />이전 항목: 1번의 모든 항목(이메일, 이름, 입력한 데이터, 알림 수신 정보 등)
            </li>
            <li>
              <b className="text-gray-800 dark:text-gray-200">Functional Software, Inc.(Sentry)</b> (미국) · 앱 오류 수집
              <br />이전 항목: 오류 내용, 앱 버전, 브라우저 종류, 계정 ID · 보관 기간: 최대 90일
            </li>
          </ul>
          <p className="mt-2">타임박스 알림은 이용자 브라우저의 알림 서비스(Google, Apple, Mozilla 등)를 거쳐 전달되며, 알림 내용은 암호화되어 해당 업체가 읽을 수 없습니다.</p>
          <p className="mt-1.5">국외 이전을 원하지 않는 경우 회원 탈퇴를 통해 거부할 수 있으나, 이 경우 서비스를 이용할 수 없습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">5. 이용자의 권리와 행사 방법</h2>
          <p>이용자는 언제든지 본인의 개인정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있습니다. 설정 &gt; 계정 · 데이터에서 본인의 데이터를 내보내거나(백업), 계정 삭제를 통해 계정과 모든 데이터를 즉시 삭제할 수 있으며, 그 밖의 요청은 아래 보호책임자에게 하실 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">6. 개인정보의 파기 절차 및 방법</h2>
          <p>회원 탈퇴 시 데이터베이스에서 계정과 연결된 모든 데이터를 즉시 삭제하며, 삭제된 데이터는 복구할 수 없습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">7. 개인정보의 안전성 확보 조치</h2>
          <p>비밀번호는 암호화되어 저장되며, 모든 통신은 암호화(HTTPS)되어 전송됩니다. 각 이용자의 데이터는 본인만 접근할 수 있도록 접근 제어(Row Level Security)가 적용되어 있으며, 이용자가 보낸 의견은 운영자만 열람할 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-gray-900 dark:text-gray-100 mb-1.5">8. 개인정보 보호책임자</h2>
          {PRIVACY_OFFICER.name || PRIVACY_OFFICER.email ? (
            <p>
              {PRIVACY_OFFICER.name && <>성명: {PRIVACY_OFFICER.name}<br /></>}
              {PRIVACY_OFFICER.email && <>이메일: {PRIVACY_OFFICER.email}</>}
            </p>
          ) : (
            <p>서비스 운영자 · 연락: 설정 &gt; 도움 · 의견 &gt; 의견 보내기</p>
          )}
          <p className="mt-1.5">개인정보 침해에 대한 신고나 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(www.kopico.go.kr, 1833-6972)에 문의하실 수 있습니다.</p>
        </section>

        <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
          문의사항이 있으시면 설정 &gt; 도움 · 의견 &gt; 의견 보내기를 이용해 주세요.
        </p>
        </div>
      </div>
    </div>
  );
}
