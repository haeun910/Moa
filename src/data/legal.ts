// 개인정보처리방침에 들어가는 운영자 정보. 비어 있으면 화면에는 "의견 보내기로 문의"로 대신 표시됨.
// ⚠️ 정식 운영 전에 실제 값으로 채우세요 (개인정보 보호법상 보호책임자 성명·연락처는 필수 기재 사항).
export const PRIVACY_OFFICER = {
  name: '장하은',   // 개인정보 보호책임자 성명
  email: 'jhe290609@gmail.com',  // 연락 이메일
};

// Supabase 프로젝트 지역 (대시보드 → Project Settings → General → Region에서 확인)
// 예: '대한민국(서울, ap-northeast-2)' / '미국(버지니아, us-east-1)'. 비어 있으면 지역 없이 표시됨
export const SUPABASE_REGION = '싱가포르(ap-southeast-1)';

export const PRIVACY_UPDATED_AT = '2026년 10월 8일';
