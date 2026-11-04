import type React from 'react';
import { createContext, useContext, useMemo } from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// 메모 보기 화면: 마크다운을 꾸며서 보여줌 (제목, 목록, 체크리스트, 굵게, 링크, 표, 인용, 코드)
// - 링크는 새 창으로 열림 (주소를 그대로 붙여 넣어도 링크가 됨)
// - 체크리스트(- [ ])는 보기 화면에서 바로 눌러 체크할 수 있음
// - 글 안의 HTML 태그는 실행하지 않고 글자 그대로 보여줌

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

// remark/rehype 플러그인 (unified 형식): this.data()로 파서 설정, 돌려주는 함수가 문서 나무를 고침
type Plugin = (this: { data: () => Record<string, unknown> }) => void | ((tree: unknown, file: unknown) => void);

function walk(node: MdNode, fn: (node: MdNode, parent: MdNode | null) => void, parent: MdNode | null = null) {
  fn(node, parent);
  if (node.children) for (const child of [...node.children]) walk(child, fn, node);
}

// 평범한 메모가 마크다운 때문에 이상하게 보이지 않도록 끄는 문법:
// 앞에 띄어쓰기 4칸 = 코드 상자, HTML 태그
const remarkPlainFriendly: Plugin = function () {
  const data = this.data() as { micromarkExtensions?: unknown[] };
  (data.micromarkExtensions ??= []).push({ disable: { null: ['codeIndented', 'htmlFlow', 'htmlText'] } });
};

// 주소 바로 뒤에 한글이 붙으면(예: https://naver.com에서) 한글 앞에서 링크를 끊음
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const remarkKoreanAutolink: Plugin = function () {
  return (tree, file) => {
    const source = String(file);
    walk(tree as MdNode, (node, parent) => {
      if (node.type !== 'link' || !parent?.children || !node.url) return;
      const start = node.position?.start.offset;
      if (start === undefined || source[start] === '[' || source[start] === '<') return; // [글](주소), <주소>는 그대로
      const text = node.children?.length === 1 && node.children[0].type === 'text' ? node.children[0].value ?? '' : '';
      const k = text.search(HANGUL);
      if (k <= 0) return;
      const rest = text.slice(k);
      if (!node.url.endsWith(rest)) return;
      const link: MdNode = { ...node, url: node.url.slice(0, -rest.length), children: [{ type: 'text', value: text.slice(0, k) }] };
      const i = parent.children.indexOf(node);
      parent.children.splice(i, 1, link, { type: 'text', value: rest });
    });
  };
};

// 보기 화면을 눌렀을 때 원래 글의 어디인지 찾을 수 있게, 각 요소에 원문 위치를 적어 둠
const rehypeSourcePos: Plugin = function () {
  return tree => {
    walk(tree as MdNode, node => {
      if (node.type !== 'element' || !node.position) return;
      const { start, end } = node.position;
      if (start.offset === undefined || end.offset === undefined) return;
      node.properties = { ...node.properties, dataS: start.offset, dataE: end.offset };
    });
  };
};

const REMARK = [remarkPlainFriendly, [remarkGfm, { singleTilde: false }], remarkBreaks, remarkKoreanAutolink] as NonNullable<Parameters<typeof Markdown>[0]['remarkPlugins']>;
const REHYPE = [rehypeSourcePos] as NonNullable<Parameters<typeof Markdown>[0]['rehypePlugins']>;

const TaskContext = createContext<{ offset: number; onToggle: (offset: number) => void } | null>(null);
const ToggleContext = createContext<((offset: number) => void) | null>(null);

function firstCheckbox(node: MdNode | undefined, depth = 0): MdNode | null {
  if (!node?.children || depth > 2) return null;
  for (const c of node.children) {
    if (c.type === 'element' && c.tagName === 'input') return c;
    const found = firstCheckbox(c, depth + 1);
    if (found) return found;
  }
  return null;
}

function TaskItem({ node, className, children, ...rest }: React.ComponentProps<'li'> & { node?: MdNode }) {
  const onToggle = useContext(ToggleContext);
  const offset = node?.position?.start.offset;
  const box = firstCheckbox(node);
  if (!box || offset === undefined || !onToggle) return <li className={className} {...rest}>{children}</li>;
  const done = !!box.properties?.checked;
  return (
    <TaskContext.Provider value={{ offset, onToggle }}>
      <li className={`${className ?? ''} ${done ? 'is-done' : ''}`} {...rest}>{children}</li>
    </TaskContext.Provider>
  );
}

function TaskBox({ checked }: { checked?: boolean }) {
  const task = useContext(TaskContext);
  return (
    <input type="checkbox" checked={!!checked} disabled={!task} aria-label={checked ? '체크 해제' : '체크'}
      onChange={() => task?.onToggle(task.offset)} />
  );
}

const COMPONENTS: Components = {
  a: ({ node: _node, href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
  ),
  img: ({ node: _node, src, alt, ...rest }) => <img {...rest} src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />,
  table: ({ node: _node, ...rest }) => <div className="md-table"><table {...rest} /></div>,
  li: ({ node, ...rest }) => <TaskItem node={node as MdNode | undefined} {...rest} />,
  input: ({ node: _node, type, checked }) => type === 'checkbox' ? <TaskBox checked={checked} /> : null,
};

export default function MarkdownView({ source, onToggleTask }: { source: string; onToggleTask?: (offset: number) => void }) {
  const tree = useMemo(() => (
    <Markdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={COMPONENTS}>{source}</Markdown>
  ), [source]);
  return (
    <ToggleContext.Provider value={onToggleTask ?? null}>
      <div className="md">{tree}</div>
    </ToggleContext.Provider>
  );
}
