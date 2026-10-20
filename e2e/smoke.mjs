// ============================================================
// 화면 스모크 테스트 (Playwright, 실제 Supabase 없이)
//
// 1) 로그인 전: 로그인 화면이 오류 없이 뜨는지
// 2) 로그인 후: 할 일이 1,000개를 넘어도 끝까지 불러오는지 (Supabase API를 흉내 내서 2,345개를 돌려줌)
// 3) 타임박스 반복: 매주 고정 블록을 만들면 회차마다 블록이 같은 묶음(series_id)으로 저장되는지
// 4) 타임박스 연동: 시간이 정해진 오늘 할 일·일정과 D-Day가 타임박스에 보이는지
// 5) 홈: 오늘 요약(카테고리별 할 일·일정·D-Day)이 보이고, "달력" 메뉴로 월 달력이 열리는지
// 6) 설정: 끈 기능(타임박스)은 메뉴·홈에서 빠지고, 공휴일(한글날)이 홈과 달력에 보이는지
//
// 실행: npm run test:e2e   (먼저 테스트용 빌드를 만들고 미리보기 서버를 띄움)
// ============================================================
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}`;
const SUPABASE = 'http://127.0.0.1:54321'; // 빌드할 때 넣은 가짜 주소 (package.json의 test:e2e)
const USER_ID = '00000000-0000-0000-0000-0000000000aa';
const TOTAL_TODOS = 2345;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

function fakeJwt(payload) {
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;
}

async function waitForServer(url, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(url)).ok) return; } catch { /* 아직 안 뜸 */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`server did not start: ${url}`);
}

// 가짜 Supabase REST API: todos는 TOTAL_TODOS개, 나머지는 빈 목록
async function mockSupabase(page, seen, settingsOverride = {}) {
  // 브라우저는 한국 시간으로 띄우므로 오늘 날짜도 한국 시간 기준 (UTC로 하면 오후 3시~자정 사이에 하루 어긋남)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const todos = Array.from({ length: TOTAL_TODOS }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    user_id: USER_ID, title: `할 일 ${i + 1}`, completed: false, category_id: i === TOTAL_TODOS - 1 ? 'cat-1' : null, subcategory_id: null,
    date: i === TOTAL_TODOS - 1 ? today : null, due_date: null, is_dday: false, start_time: i === TOTAL_TODOS - 1 ? '10:00' : null, notes: null,
    sort_order: i, series_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }));
  const categories = [{ id: 'cat-1', user_id: USER_ID, name: '공부', color: '#4F73A8', description: null, is_default: false, sort_order: 0, created_at: '2026-01-01T00:00:00Z' }];
  const notes = [{ id: 'note-1', user_id: USER_ID, title: '장보기 목록', content: '우유, 계란', folder_id: null, pinned: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }];
  const schedules = [{ id: 'sch-1', user_id: USER_ID, title: '치과 예약', date: today, start_time: '14:00', notes: null, series_id: null, created_at: '2026-01-01T00:00:00Z' }];
  const ddays = [{ id: 'dd-1', user_id: USER_ID, title: '시험날', target_date: today, created_at: '2026-01-01T00:00:00Z' }];
  const settings = {
    user_id: USER_ID, theme: 'light', default_screen: 'today', notifications: false, list_sort_by: 'manual',
    hide_completed: false, hidden_category_ids: [], calendar_text_size: 'medium', updated_at: '2026-01-01T00:00:00Z',
    ...settingsOverride,
  };

  await page.route(`${SUPABASE}/**`, async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.replace('/rest/v1/', '');
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (table === 'todos') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      seen.todoPages.push(offset);
      return route.fulfill({ json: todos.slice(offset, offset + limit) });
    }
    if (table === 'timeblocks' && route.request().method() === 'POST') {
      seen.timeblockInserts.push(JSON.parse(route.request().postData() ?? '[]'));
      return route.fulfill({ json: [] });
    }
    if (table === 'categories' && route.request().method() === 'GET') return route.fulfill({ json: categories });
    if (table === 'notes' && route.request().method() === 'GET') return route.fulfill({ json: notes });
    if (table === 'schedules' && route.request().method() === 'GET') return route.fulfill({ json: schedules });
    if (table === 'ddays' && route.request().method() === 'GET') return route.fulfill({ json: ddays });
    if (table === 'user_settings') return route.fulfill({ json: wantsObject ? settings : [settings] });
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: wantsObject ? {} : [] });
    return route.fulfill({ status: 404, body: '' });
  });
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
try {
  await waitForServer(BASE);
  // 설치된 크롬을 쓰려면 CHROMIUM_PATH로 실행 파일 위치를 넘김 (없으면 Playwright가 받은 브라우저)
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  // 1) 로그인 전
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE);
    await page.getByRole('button', { name: '로그인', exact: true }).first().waitFor({ timeout: 10000 });
    if (errors.length) fail(`로그인 화면에서 오류: ${errors.join(' / ')}`);
    else console.log('✅ 로그인 화면이 오류 없이 뜸');
    await page.close();
  }

  // 로그인한 상태의 새 브라우저 창
  async function loggedInContext({ settings, fixedTime } = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Seoul' });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const session = {
      access_token: fakeJwt({ sub: USER_ID, role: 'authenticated', exp, aud: 'authenticated' }),
      refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp,
      user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'e2e@test.local', app_metadata: { providers: ['email'] }, user_metadata: {} },
    };
    // supabase-js가 세션을 저장하는 키: sb-<주소 첫 부분>-auth-token
    await context.addInitScript(([key, value]) => {
      localStorage.setItem(key, value);
      localStorage.setItem('onboarding-done-00000000-0000-0000-0000-0000000000aa', '1'); // 사용 가이드 창 건너뛰기
    }, ['sb-127-auth-token', JSON.stringify(session)]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const seen = { todoPages: [], timeblockInserts: [] };
    if (fixedTime) await page.clock.setFixedTime(fixedTime);
    await mockSupabase(page, seen, settings);
    return { context, page, errors, seen };
  }

  // 2) 로그인 후 - 1,000개가 넘는 할 일
  {
    const { context, page, errors, seen } = await loggedInContext();
    await page.goto(BASE);
    // 화면 크기에 따라 숨겨진 쪽 목록에 있을 수 있어서 "화면에 그려졌는지"만 확인
    await page.getByText(`할 일 ${TOTAL_TODOS}`, { exact: true }).first().waitFor({ state: 'attached', timeout: 15000 });

    const firstLoad = [...new Set(seen.todoPages)].sort((a, b) => a - b);
    if (firstLoad.join(',') !== '0,1000,2000') fail(`할 일을 1,000개씩 나눠 끝까지 받아야 함 (받은 위치: ${firstLoad.join(',')})`);
    else console.log(`✅ 할 일 ${TOTAL_TODOS}개를 3번에 나눠 끝까지 불러옴 (마지막 할 일까지 화면에 그려짐)`);
    if (errors.length) fail(`로그인 후 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 3) 타임박스 매주 고정 블록
  {
    const { context, page, errors, seen } = await loggedInContext();
    await page.goto(`${BASE}/?screen=timebox`);
    await page.getByRole('button', { name: /^추가$|타임박스 추가/ }).first().click({ timeout: 15000 });
    await page.getByPlaceholder('무엇을 할까요?').fill('운동');
    await page.getByRole('button', { name: '매주', exact: true }).click();
    const save = page.getByRole('button', { name: /^\d+개 추가$/ });
    const label = await save.textContent();
    const expected = Number(label.match(/\d+/)[0]);
    await save.click();
    await page.waitForTimeout(500);
    const rows = seen.timeblockInserts.flat();
    const seriesIds = new Set(rows.map(r => r.series_id));
    if (rows.length !== expected || expected < 50) fail(`매주 반복 블록 ${expected}개가 저장돼야 함 (저장된 개수: ${rows.length})`);
    else if (seriesIds.size !== 1 || !rows[0].series_id) fail('반복 블록은 같은 series_id로 묶여야 함');
    else if (new Set(rows.map(r => new Date(r.start_at).getDay())).size !== 1) fail('매주 반복은 같은 요일에만 만들어져야 함');
    else console.log(`✅ 타임박스 매주 반복: 1년치 ${rows.length}개 블록이 한 묶음으로 저장됨`);
    if (errors.length) fail(`타임박스 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 4) 시간이 정해진 할 일·일정, D-Day가 타임박스에 같이 보임
  {
    const { context, page, errors } = await loggedInContext();
    await page.goto(`${BASE}/?screen=timebox`);
    const todoItem = page.locator('[data-agenda="todo"]', { hasText: `할 일 ${TOTAL_TODOS}` });
    const scheduleItem = page.locator('[data-agenda="schedule"]', { hasText: '치과 예약' });
    try {
      await todoItem.first().waitFor({ timeout: 15000 });
      await scheduleItem.first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: '시험날' }).first().waitFor({ timeout: 5000 });
      console.log('✅ 타임박스 연동: 10시 할 일, 14시 일정, 오늘 D-Day가 타임박스에 보임');
    } catch {
      fail('시간이 정해진 할 일·일정과 D-Day가 타임박스에 보여야 함');
    }
    if (errors.length) fail(`타임박스 연동 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 5) 홈 요약 화면 + 달력 메뉴
  {
    const { context, page, errors } = await loggedInContext();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE);
    try {
      await page.getByRole('heading', { name: '오늘 할 일' }).waitFor({ timeout: 15000 });
      await page.getByText(`할 일 ${TOTAL_TODOS}`, { exact: true }).first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /치과 예약/ }).first().waitFor({ timeout: 5000 });
      await page.getByText('오늘 진행률').waitFor({ timeout: 5000 });
      await page.getByText('공부', { exact: true }).first().waitFor({ timeout: 5000 }); // 오늘 할 일이 카테고리별로 묶여 보임
      await page.getByRole('button', { name: '오늘 일정 도움말' }).click();
      await page.getByText('정해진 날짜와 시간에 있는 약속이에요.', { exact: false }).waitFor({ timeout: 5000 }); // 물음표 안내
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/home-desktop.png`, fullPage: true });
      await page.mouse.click(5, 5);
      if (process.env.SHOT_DIR) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: `${process.env.SHOT_DIR}/home-mobile.png` });
        await page.setViewportSize({ width: 1280, height: 900 });
      }
      await page.getByRole('textbox', { name: '빠른 메모' }).waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /장보기 목록/ }).click(); // 홈 메모를 누르면 메모 화면에서 그 메모가 열림
      await page.waitForFunction(() => [...document.querySelectorAll('input')].some(i => i.value === '장보기 목록'), null, { timeout: 10000 });
      await page.getByRole('button', { name: '달력', exact: true }).first().click();
      await page.getByRole('tablist', { name: '달력 보기' }).waitFor({ timeout: 10000 });
      console.log('✅ 홈: 오늘 요약·메모가 보이고, 메모를 누르면 메모 화면에서 열리고, 달력 메뉴로 월 달력이 열림');
    } catch {
      fail('홈에 오늘 요약이 보이고 달력 메뉴로 월 달력이 열려야 함');
    }
    if (errors.length) fail(`홈 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 6) 기능 끄기 + 공휴일 (2026-10-09 한글날로 시계를 고정)
  {
    const { context, page, errors } = await loggedInContext({
      settings: { hidden_features: ['timebox'], show_holidays: true },
      fixedTime: new Date('2026-10-09T10:00:00+09:00'),
    });
    await page.goto(BASE);
    try {
      await page.getByRole('heading', { name: '오늘 할 일' }).waitFor({ timeout: 15000 });
      await page.getByRole('heading', { level: 1 }).getByText('한글날').waitFor({ timeout: 10000 }); // 홈 날짜 옆 공휴일
      if (await page.getByRole('button', { name: '타임박스', exact: true }).count()) throw new Error('타임박스 메뉴가 남아 있음');
      if (await page.getByText('오늘 타임박스').count()) throw new Error('홈에 타임박스가 남아 있음');
      await page.getByRole('button', { name: '달력', exact: true }).first().click();
      await page.getByRole('button', { name: /10월 3일 토요일 개천절/ }).waitFor({ timeout: 10000 }); // 월 달력 칸에 공휴일
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/calendar-holidays.png` });
      console.log('✅ 설정: 끈 타임박스는 메뉴·홈에서 빠지고, 한글날·개천절이 홈과 달력에 보임');
    } catch (e) {
      fail(`끈 기능은 숨겨지고 공휴일이 보여야 함 (${e.message})`);
    }
    if (errors.length) fail(`설정 테스트 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  await browser.close();
} finally {
  server.kill();
}
