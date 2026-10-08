// 같은 항목에 대한 저장 요청을 보낸 순서대로 하나씩 보내기.
// 완료 체크를 빠르게 여러 번 누르면 요청들이 동시에 날아가 서버에 도착 순서가 뒤바뀔 수 있고,
// 그러면 화면은 '완료'인데 DB에는 '미완료'가 남는 일이 생김. 앞 요청이 끝난 뒤에 다음 요청을 보내서 막음.
export function createSerialWriter() {
  const tails = new Map<string, Promise<unknown>>();
  return function run<T>(key: string, send: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    // 앞 요청이 실패해도 다음 요청은 보냄 (실패는 앞 요청을 부른 쪽에서 처리)
    const next = prev.catch(() => {}).then(send);
    tails.set(key, next);
    const cleanup = () => { if (tails.get(key) === next) tails.delete(key); };
    next.then(cleanup, cleanup);
    return next;
  };
}
