import { describe, expect, it } from 'vitest';
import { continueList, markdownToPlain, noteHeading, notePreview, toggleTaskAt } from './markdown';

describe('markdownToPlain', () => {
  it('기호는 빼고 글자만', () => {
    expect(markdownToPlain('## 회의 준비\n- [ ] **자료** 만들기\n- [x] 메일 [보내기](https://a.com)\n\n---\n> 인용 `코드`')).toBe('회의 준비 자료 만들기 메일 보내기 인용 코드');
    expect(markdownToPlain('1. 첫째\n2) 둘째')).toBe('첫째 둘째');
    expect(markdownToPlain('*기울임* 과 _밑줄_ 과 ~~취소~~')).toBe('기울임 과 밑줄 과 취소');
  });
  it('평범한 글은 그대로', () => {
    expect(markdownToPlain('3*4=12, snake_case_name, #해시태그')).toBe('3*4=12, snake_case_name, #해시태그');
  });
});

describe('noteHeading / notePreview', () => {
  it('제목이 없으면 첫 줄이 제목', () => {
    const n = { title: '', content: '# 장보기\n- 우유\n- 계란' };
    expect(noteHeading(n)).toBe('장보기');
    expect(notePreview(n)).toBe('우유 계란');
    expect(noteHeading({ title: '', content: '\n\n' })).toBe('새 메모');
  });
});

describe('toggleTaskAt', () => {
  it('체크 켜고 끄기', () => {
    const src = '할 일\n- [ ] 우유\n- [x] 계란';
    const on = toggleTaskAt(src, src.indexOf('- [ ]'));
    expect(on).toBe('할 일\n- [x] 우유\n- [x] 계란');
    expect(toggleTaskAt(on, on.lastIndexOf('- [x]'))).toBe('할 일\n- [x] 우유\n- [ ] 계란');
    expect(toggleTaskAt(src, 0)).toBe(src);
  });
});

describe('continueList', () => {
  it('목록 이어 쓰기', () => {
    expect(continueList('- 우유', '')).toEqual({ insert: '\n- ' });
    expect(continueList('  3. 셋째', '')).toEqual({ insert: '\n  4. ' });
    expect(continueList('- [x] 끝낸 일', '')).toEqual({ insert: '\n- [ ] ' });
    expect(continueList('- ', '')).toEqual({ end: true });
    expect(continueList('- [ ] ', '')).toEqual({ end: true });
    expect(continueList('그냥 글', '')).toBeNull();
    expect(continueList('-하이픈', '')).toBeNull();
  });
});
