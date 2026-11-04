// 이 기기에 남겨 둔 오프라인용 자료(마지막 화면 내용, 보내지 못한 변경) 관리
import { clearOutboxFor } from './outbox';
import { offlineStore } from './offlineStore';

export const snapshotKey = (userId: string) => `snapshot:${userId}`;

// 로그아웃·체험 끝내기·탈퇴: 그 계정의 자료를 이 기기에서 지움
export async function clearOfflineData(userId: string) {
  await Promise.all([clearOutboxFor(userId), offlineStore.delete('kv', snapshotKey(userId))]).catch(() => {});
}
