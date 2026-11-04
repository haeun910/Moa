// 카테고리 관리 화면을 어디서 열었는지 (저장소 바로가기로 열었으면 뒤로 가기도 저장소로,
// 아래 메뉴·왼쪽 메뉴에도 저장소(폰은 홈) 아래 화면으로 표시)
export const CATEGORIES_BACK_KEY = 'categories-back';

export type CategoriesOrigin = 'all' | 'settings';

let origin: CategoriesOrigin = (() => {
  try { return sessionStorage.getItem(CATEGORIES_BACK_KEY) === 'all' ? 'all' : 'settings'; } catch { return 'settings'; }
})();

export function setCategoriesOrigin(next: CategoriesOrigin) {
  origin = next;
  try { sessionStorage.setItem(CATEGORIES_BACK_KEY, next); } catch { /* 새로고침하면 설정 아래로 보일 뿐 */ }
}

export function categoriesOrigin(): CategoriesOrigin {
  return origin;
}
