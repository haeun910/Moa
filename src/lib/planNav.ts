import type { Screen } from '../types';

// 프로젝트 로드맵(준비 계획) 화면을 어디서 열었는지와 어떤 D-Day를 보고 있는지.
// D-Day 창에서 열면 그 D-Day를 바로 보여 주고, 뒤로 가기는 열었던 화면으로.
// 새로고침해도 이어지도록 sessionStorage에도 맡겨 둠
const KEY = 'moa-plan';

interface PlanNav { ddayId: string | null; origin: Screen }

let state: PlanNav = (() => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlanNav>;
      return { ddayId: typeof parsed.ddayId === 'string' ? parsed.ddayId : null, origin: (parsed.origin as Screen) ?? 'settings' };
    }
  } catch { /* 처음 상태로 */ }
  return { ddayId: null, origin: 'settings' };
})();

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 새로고침하면 처음 D-Day로 보일 뿐 */ }
}

// origin: 뒤로 가기로 돌아갈 화면. ddayId를 안 주면 지난번에 보던 D-Day를 그대로 보여 줌
export function setPlanTarget(origin: Screen, ddayId?: string) {
  state = { ddayId: ddayId ?? state.ddayId, origin: origin === 'project' ? state.origin : origin };
  save();
}

export function setPlanDday(ddayId: string | null) {
  state = { ...state, ddayId };
  save();
}

export function planTarget(): PlanNav {
  return state;
}
