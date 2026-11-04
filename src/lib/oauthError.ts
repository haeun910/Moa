// 구글 로그인(또는 게스트 계정에 구글 연결)에서 돌아왔는데 실패한 경우, 주소에 붙어 오는 오류를 읽고 주소는 깨끗하게 정리
export function readOAuthError(): string {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('error') ?? hash.get('error');
  if (!code) return '';
  const detail = params.get('error_code') ?? hash.get('error_code');
  window.history.replaceState(null, '', window.location.pathname);
  if (code === 'access_denied') return 'Google 로그인이 취소되었습니다.';
  if (detail === 'identity_already_exists') {
    return '이 Google 계정은 이미 모아 계정이 있어요. 체험 내용은 그대로 있어요. 그 계정을 쓰려면 화면 아래 체험 안내의 "로그인"을 눌러 Google로 로그인해 주세요.';
  }
  return 'Google 로그인에 실패했습니다. 잠시 후 다시 시도하거나 이메일로 로그인해 주세요.';
}
