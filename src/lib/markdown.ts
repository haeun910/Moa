// 메모는 마크다운으로 저장됨. 목록·검색 미리보기에서는 기호를 빼고 글자만 보여줌
import type { Note } from '../types';

// 한 줄의 마크다운 기호 지우기 (# 제목, - 목록, 1. 번호, > 인용, [ ] 체크, **굵게**, [링크](주소) 등)
function plainLine(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/^\s*(?:[-*_]\s*){3,}$/, '')
    .replace(/^\s*```.*$/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1')
    // (뒤를 보는 정규식은 옛 아이폰 사파리에서 오류가 나서 쓰지 않음)
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/~~(\S(?:.*?\S)?)~~/g, '$1')
    .replace(/(^|[^\w*])\*(\S(?:[^*]*?\S)?)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^\w_])_(\S(?:[^_]*?\S)?)_(?![\w_])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

// 여러 줄을 기호 없는 한 덩어리 글로 (빈 줄·구분선은 건너뜀)
export function markdownToPlain(text: string): string {
  return text.split('\n').map(plainLine).filter(Boolean).join(' ');
}

// 제목이 없으면 내용 첫 줄을 제목처럼 보여줌
export function noteHeading(n: Pick<Note, 'title' | 'content'>): string {
  if (n.title.trim()) return n.title.trim();
  const first = n.content.split('\n').map(plainLine).find(Boolean);
  return first || '새 메모';
}

// 목록에 보여줄 내용 미리보기 (제목이 없어 첫 줄을 제목으로 썼으면 그 줄은 빼고)
export function notePreview(n: Pick<Note, 'title' | 'content'>): string {
  const lines = n.content.split('\n').map(plainLine).filter(Boolean);
  return (n.title.trim() ? lines : lines.slice(1)).join(' ');
}

// "- [ ] 할 일" 체크박스 켜고 끄기: 목록 줄이 시작하는 자리(offset)부터 처음 나오는 [ ] / [x]를 바꿈
export function toggleTaskAt(source: string, itemOffset: number): string {
  const rest = source.slice(itemOffset);
  const m = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/.exec(rest);
  if (!m) return source;
  const at = itemOffset + m[1].length + 1;
  return source.slice(0, at) + (m[2] === ' ' ? 'x' : ' ') + source.slice(at + 1);
}

// 목록 줄에서 Enter: 같은 모양의 다음 줄 표시를 만들어 줌. 빈 항목에서 Enter면 목록을 끝냄
// 돌려주는 값: null = 목록 줄이 아님(평소처럼 줄바꿈), { end: true } = 표시 지우기, { insert } = 넣을 글
export function continueList(lineBeforeCaret: string, lineAfterCaret: string): { insert: string } | { end: true } | null {
  const m = /^(\s*)(?:([-*+])|(\d+)([.)]))\s+(\[[ xX]\]\s+)?/.exec(lineBeforeCaret);
  if (!m) return null;
  if (m[0].length === lineBeforeCaret.length && !lineAfterCaret.trim()) return { end: true };
  const marker = m[2] ?? `${Number(m[3]) + 1}${m[4]}`;
  return { insert: `\n${m[1]}${marker} ${m[5] ? '[ ] ' : ''}` };
}
