// 월 달력에서 여러 날에 걸친 일정을 한 줄로 이어 그리기 위한 자리(줄) 배정.
// 한 주(7칸) 안에서 겹치는 일정끼리는 다른 줄에, 안 겹치면 같은 줄에 놓음.
// 모든 칸에서 같은 일정은 같은 줄에 있어야 막대가 끊기지 않으므로, 칸마다 따로 정하지 않고 주 단위로 정함.

export interface LaneSegment<T> {
  item: T;
  lane: number; // 0부터: 칸 안에서 몇 번째 줄인지
  startCol: number; // 이 주에서 시작하는 칸 (0 = 일요일)
  endCol: number; // 이 주에서 끝나는 칸 (포함)
  continuesBefore: boolean; // 지난주부터 이어짐
  continuesAfter: boolean; // 다음 주로 이어짐
}

// weekKeys: 그 주의 날짜 7개 (YYYY-MM-DD, 오름차순)
// range: 항목의 [시작일, 끝일] (YYYY-MM-DD, 끝일 포함)
export function weekLanes<T extends { id: string }>(
  weekKeys: string[],
  items: T[],
  range: (item: T) => [string, string],
): LaneSegment<T>[] {
  if (weekKeys.length === 0) return [];
  const first = weekKeys[0];
  const last = weekKeys[weekKeys.length - 1];
  const segs: Omit<LaneSegment<T>, 'lane'>[] = [];
  for (const item of items) {
    const [from, to] = range(item);
    if (to < first || from > last) continue;
    const startCol = from <= first ? 0 : weekKeys.findIndex(k => k >= from);
    let endCol = weekKeys.length - 1;
    if (to < last) {
      // to 이하인 마지막 칸
      for (let i = weekKeys.length - 1; i >= 0; i--) {
        if (weekKeys[i] <= to) { endCol = i; break; }
      }
    }
    if (startCol < 0 || endCol < startCol) continue;
    segs.push({ item, startCol, endCol, continuesBefore: from < first, continuesAfter: to > last });
  }
  // 먼저 시작하는 것, 같은 날 시작하면 긴 것부터 위쪽 줄 (다른 달력 앱과 같은 순서)
  segs.sort((a, b) =>
    a.startCol - b.startCol
    || (b.endCol - b.startCol) - (a.endCol - a.startCol)
    || range(a.item)[0].localeCompare(range(b.item)[0])
    || a.item.id.localeCompare(b.item.id));
  const lanes: Array<Array<[number, number]>> = [];
  return segs.map(seg => {
    let lane = 0;
    while (lanes[lane]?.some(([s, e]) => !(seg.endCol < s || seg.startCol > e))) lane++;
    (lanes[lane] ??= []).push([seg.startCol, seg.endCol]);
    return { ...seg, lane };
  });
}
