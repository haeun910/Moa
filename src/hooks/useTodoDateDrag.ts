import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Todo } from '../types';

// 달력 "할 일 배치"에서 할 일을 날짜 칸으로 끌어다 놓기.
// 날짜 칸은 data-drop-date="YYYY-MM-DD"를 달고 있으면 됨 (월 달력 칸, 주간 보기 칸).
// - 마우스: 누른 채 조금 움직이면 끌기 시작 (그냥 누르면 클릭 = "고르기")
// - 터치(태블릿): 꾹 누르면 끌기 시작. 그 전에 손가락이 움직이면 목록 스크롤로 봄
const DRAG_START_PX = 5;
const LONG_PRESS_MS = 380;
const LONG_PRESS_SLOP_PX = 10;
const EDGE_PX = 48; // 달력 위·아래 끝 근처로 끌면 그쪽으로 스크롤
const EDGE_STEP_PX = 14;

export interface DateDragState {
  todo: Todo;
  x: number;
  y: number;
  date: string | null; // 지금 손가락·포인터 아래 날짜 칸
}

function dateAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return el?.closest<HTMLElement>('[data-drop-date]')?.dataset.dropDate ?? null;
}

function scrollNearEdge(y: number) {
  const scroller = document.querySelector<HTMLElement>('[data-calendar-scroller]');
  if (!scroller) return;
  const r = scroller.getBoundingClientRect();
  if (y < r.top + EDGE_PX) scroller.scrollBy(0, -EDGE_STEP_PX);
  else if (y > r.bottom - EDGE_PX) scroller.scrollBy(0, EDGE_STEP_PX);
}

export function useTodoDateDrag(onDrop: (todo: Todo, date: string) => void) {
  const [drag, setDrag] = useState<DateDragState | null>(null);
  const onDropRef = useRef(onDrop);
  useLayoutEffect(() => { onDropRef.current = onDrop; });
  const cleanupRef = useRef<(() => void) | null>(null);
  // 끌어다 놓은 직후 따라오는 click은 "고르기"로 보지 않음 (시계 대신 타이머로 풀어서 기기 시간과 무관)
  const suppressClick = useRef(false);

  useEffect(() => () => cleanupRef.current?.(), []);

  const begin = useCallback((todo: Todo, x: number, y: number) => {
    document.documentElement.classList.add('is-date-dragging');
    setDrag({ todo, x, y, date: dateAt(x, y) });
  }, []);

  const finish = useCallback((todo: Todo, x: number | null, y: number | null) => {
    document.documentElement.classList.remove('is-date-dragging');
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 350);
    const date = x === null || y === null ? null : dateAt(x, y);
    setDrag(null);
    if (date) onDropRef.current(todo, date);
  }, []);

  const startMouse = useCallback((e: React.PointerEvent, todo: Todo) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cleanupRef.current?.();
    const ox = e.clientX;
    const oy = e.clientY;
    let active = false;
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - ox, ev.clientY - oy) < DRAG_START_PX) return;
        active = true;
        begin(todo, ev.clientX, ev.clientY);
        return;
      }
      scrollNearEdge(ev.clientY);
      setDrag({ todo, x: ev.clientX, y: ev.clientY, date: dateAt(ev.clientX, ev.clientY) });
    };
    const end = (ev: PointerEvent) => {
      cleanup();
      if (active) finish(todo, ev.type === 'pointerup' ? ev.clientX : null, ev.type === 'pointerup' ? ev.clientY : null);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !active) return;
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
      finish(todo, null, null);
    };
    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('keydown', key, true);
      cleanupRef.current = null;
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', key, true);
    cleanupRef.current = () => { cleanup(); if (active) finish(todo, null, null); };
  }, [begin, finish]);

  const startTouch = useCallback((e: React.TouchEvent, todo: Todo) => {
    if (e.touches.length !== 1) return;
    cleanupRef.current?.();
    // 터치 이벤트는 손가락을 처음 댄 요소로 계속 전달되므로 그 요소에 붙임
    const target = e.currentTarget;
    let x = e.touches[0].clientX;
    let y = e.touches[0].clientY;
    const ox = x;
    const oy = y;
    let active = false;
    const timer = window.setTimeout(() => {
      active = true;
      try { navigator.vibrate?.(12); } catch { /* 진동이 없는 기기 */ }
      begin(todo, x, y);
    }, LONG_PRESS_MS);
    const move = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      x = t.clientX;
      y = t.clientY;
      if (!active) {
        if (Math.hypot(x - ox, y - oy) > LONG_PRESS_SLOP_PX) cleanup(); // 스크롤
        return;
      }
      ev.preventDefault();
      scrollNearEdge(y);
      setDrag({ todo, x, y, date: dateAt(x, y) });
    };
    const end = (ev: TouchEvent) => {
      cleanup();
      if (active) finish(todo, ev.type === 'touchend' ? x : null, ev.type === 'touchend' ? y : null);
    };
    function cleanup() {
      window.clearTimeout(timer);
      target.removeEventListener('touchmove', move as EventListener);
      target.removeEventListener('touchend', end as EventListener);
      target.removeEventListener('touchcancel', end as EventListener);
      cleanupRef.current = null;
    }
    target.addEventListener('touchmove', move as EventListener, { passive: false });
    target.addEventListener('touchend', end as EventListener);
    target.addEventListener('touchcancel', end as EventListener);
    cleanupRef.current = () => { cleanup(); if (active) finish(todo, null, null); };
  }, [begin, finish]);

  const consumeClick = useCallback(() => suppressClick.current, []);

  return { drag, startMouse, startTouch, consumeClick };
}
