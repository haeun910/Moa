import type React from 'react';
import { Heading2, Bold, Italic, Strikethrough, List, ListOrdered, ListChecks, Quote, Link2, Minus } from 'lucide-react';

// 입력칸에 글 넣기. execCommand를 쓰면 Ctrl+Z(되돌리기)가 그대로 동작함 (안 되는 브라우저는 직접 넣음)
export function insertText(ta: HTMLTextAreaElement, text: string) {
  ta.focus();
  const hasSelection = ta.selectionStart !== ta.selectionEnd;
  let ok = false;
  try {
    ok = text ? document.execCommand('insertText', false, text) : hasSelection ? document.execCommand('delete', false) : true;
  } catch { ok = false; }
  if (!ok) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// **굵게** 처럼 고른 글 앞뒤에 기호 붙이기 (이미 붙어 있으면 떼기)
export function wrapSelection(ta: HTMLTextAreaElement, mark: string, placeholder: string) {
  const v = ta.value;
  let s = ta.selectionStart;
  let e = ta.selectionEnd;
  // 앞뒤 띄어쓰기까지 고르면 **글 ** 처럼 되어 꾸밈이 안 먹으므로 빼고 감쌈
  while (s < e && /\s/.test(v[s])) s++;
  while (e > s && /\s/.test(v[e - 1])) e--;
  const sel = v.slice(s, e);
  const before = v.slice(s - mark.length, s);
  const after = v.slice(e, e + mark.length);
  // *기울임* 버튼이 **굵게**의 별 하나를 떼지 않도록
  const partOfLonger = mark === '*' && v[s - mark.length - 1] === '*' && v[e + mark.length] === '*' && v[s - 3] !== '*';
  if (sel && before === mark && after === mark && !partOfLonger) {
    ta.setSelectionRange(s - mark.length, e + mark.length);
    insertText(ta, sel);
    ta.setSelectionRange(s - mark.length, e - mark.length);
    return;
  }
  const inner = sel || placeholder;
  ta.setSelectionRange(s, e);
  insertText(ta, mark + inner + mark);
  ta.setSelectionRange(s + mark.length, s + mark.length + inner.length);
}

type LineKind = 'heading' | 'bullet' | 'number' | 'task' | 'quote';
const ANY_PREFIX = /^(\s*)(?:#{1,6}\s+|>\s?|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/;
const HAS: Record<LineKind, RegExp> = {
  heading: /^\s*#{1,6}\s+/,
  bullet: /^\s*[-*+]\s+(?!\[[ xX]\]\s)/,
  number: /^\s*\d+[.)]\s+(?!\[[ xX]\]\s)/,
  task: /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/,
  quote: /^\s*>/,
};
const PREFIX: Record<LineKind, (i: number) => string> = {
  heading: () => '## ',
  bullet: () => '- ',
  number: i => `${i + 1}. `,
  task: () => '- [ ] ',
  quote: () => '> ',
};

// 고른 줄들 맨 앞에 목록/제목/인용 표시 붙이기 (모든 줄에 이미 있으면 떼기, 다른 표시는 바꿔 끼움)
export function toggleLinePrefix(ta: HTMLTextAreaElement, kind: LineKind) {
  const v = ta.value;
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  const start = v.lastIndexOf('\n', s - 1) + 1;
  const endFrom = e > s && v[e - 1] === '\n' ? e - 1 : e;
  let end = v.indexOf('\n', endFrom);
  if (end < 0) end = v.length;
  const lines = v.slice(start, end).split('\n');
  const filled = lines.filter(l => l.trim());
  const allHave = filled.length > 0 && filled.every(l => HAS[kind].test(l));
  let n = 0;
  const next = lines.map(l => {
    if (!l.trim() && lines.length > 1) return l;
    const m = ANY_PREFIX.exec(l);
    const indent = m ? m[1] : '';
    const body = m ? l.slice(m[0].length) : l;
    return allHave ? indent + body : indent + PREFIX[kind](n++) + body;
  }).join('\n');
  ta.setSelectionRange(start, end);
  insertText(ta, next);
  ta.setSelectionRange(start + next.length, start + next.length);
}

function insertLink(ta: HTMLTextAreaElement) {
  const v = ta.value;
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  const sel = v.slice(s, e).trim();
  if (/^(https?:\/\/|www\.)\S+$/i.test(sel)) {
    insertText(ta, `[링크](${sel})`);
    ta.setSelectionRange(s + 1, s + 3); // "링크"를 골라 둠: 바로 이름을 쓰면 됨
    return;
  }
  const label = sel || '링크';
  insertText(ta, `[${label}](https://)`);
  const urlAt = s + label.length + 3;
  ta.setSelectionRange(urlAt, urlAt + 'https://'.length); // 주소 자리를 골라 둠: 바로 붙여 넣으면 됨
}

function insertRule(ta: HTMLTextAreaElement) {
  const before = ta.value.slice(0, ta.selectionStart);
  // 바로 윗줄에 글이 있으면 ---가 제목 표시로 읽혀서 빈 줄을 하나 둠
  const pre = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  insertText(ta, `${pre}---\n`);
}

const TOOLS: { label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }>; run: (ta: HTMLTextAreaElement) => void; shortcut?: string }[] = [
  { label: '제목', Icon: Heading2, run: ta => toggleLinePrefix(ta, 'heading') },
  { label: '굵게', Icon: Bold, run: ta => wrapSelection(ta, '**', '굵은 글'), shortcut: 'B' },
  { label: '기울임', Icon: Italic, run: ta => wrapSelection(ta, '*', '기울인 글'), shortcut: 'I' },
  { label: '취소선', Icon: Strikethrough, run: ta => wrapSelection(ta, '~~', '지운 글') },
  { label: '목록', Icon: List, run: ta => toggleLinePrefix(ta, 'bullet') },
  { label: '번호 목록', Icon: ListOrdered, run: ta => toggleLinePrefix(ta, 'number') },
  { label: '체크리스트', Icon: ListChecks, run: ta => toggleLinePrefix(ta, 'task') },
  { label: '인용', Icon: Quote, run: ta => toggleLinePrefix(ta, 'quote') },
  { label: '링크', Icon: Link2, run: insertLink },
  { label: '구분선', Icon: Minus, run: insertRule },
];

// Ctrl/⌘+B 굵게, Ctrl/⌘+I 기울임
export function handleFormatShortcut(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return false;
  const tool = TOOLS.find(t => t.shortcut && t.shortcut.toLowerCase() === e.key.toLowerCase());
  if (!tool) return false;
  e.preventDefault();
  tool.run(e.currentTarget);
  return true;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

export default function MarkdownToolbar({ target }: { target: React.RefObject<HTMLTextAreaElement | null> }) {
  return (
    <div role="toolbar" aria-label="글 꾸미기" className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
      {TOOLS.map(({ label, Icon, run, shortcut }) => (
        <button key={label} type="button" aria-label={label} title={shortcut ? `${label} (${MOD}${shortcut})` : label}
          // 누를 때 입력칸 포커스를 뺏지 않게 (폰 키보드가 내려가지 않음)
          onMouseDown={e => e.preventDefault()}
          onClick={() => { const ta = target.current; if (ta) run(ta); }}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors">
          <Icon size={17} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
