// ============================================================
// 화면 스모크 테스트 (Playwright, 실제 Supabase 없이)
//
// 1) 로그인 전: 소개(랜딩) 화면과 로그인 화면이 오류 없이 뜨는지
// 2) 로그인 후: 할 일이 1,000개를 넘어도 끝까지 불러오는지 (Supabase API를 흉내 내서 2,345개를 돌려줌)
// 3) 타임박스 반복: 매주 고정 블록을 만들면 회차마다 블록이 같은 묶음(series_id)으로 저장되는지
// 4) 타임박스 연동: 시간이 정해진 오늘 할 일·일정(끝 시간 길이대로), 여러 날 일정, D-Day가 타임박스에 보이는지
// 5) 홈: 오늘 요약(카테고리별 할 일·일정·D-Day)이 보이고, "달력" 메뉴로 월 달력이 열리는지
// 6) 설정: 끈 기능(타임박스)은 메뉴·홈에서 빠지고, 공휴일(한글날)이 홈과 달력에 보이는지
// 7~8) 폰 하단 메뉴·날짜 팝업, 태블릿 타임박스 끌어 옮기기
// 9) 검색(Ctrl+K, 초성)으로 메모를 찾아 열고, 마크다운 링크·체크리스트가 동작하는지
// 10) 오프라인: 끊긴 상태에서 체크·추가해도 화면에 남고, 다시 연결되면 순서대로 저장되는지
// 11) 밀린 할 일: 반복 할 일은 가장 최근 한 번만 보이고 '안 하기'가 저장되는지
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
  const shift = (days) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const schedules = [
    { id: 'sch-1', user_id: USER_ID, title: '치과 예약', date: today, start_time: '14:00', end_time: '15:30', notes: null, series_id: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 'sch-2', user_id: USER_ID, title: '워크숍', date: shift(-1), end_date: shift(1), start_time: null, notes: null, series_id: null, created_at: '2026-01-01T00:00:00Z' },
  ];
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
    if (table === 'schedules' && route.request().method() === 'PATCH') {
      seen.scheduleUpdates?.push(`${url.searchParams.get('id')} ${route.request().postData()}`);
      return route.fulfill({ json: [] });
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
    try {
      await page.getByRole('heading', { level: 1, name: /한 곳에 모아/ }).waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Google로 시작하기' }).first().waitFor({ timeout: 2000 });
      await page.getByRole('button', { name: '가입 없이 둘러보기' }).first().waitFor({ timeout: 2000 });
      console.log('✅ 로그인 전 첫 화면은 소개 화면 (Google로 시작하기 / 가입 없이 둘러보기)');
    } catch {
      fail('로그인 전 첫 화면에 소개와 시작 버튼이 보여야 함');
    }
    // 머리글의 "로그인" → 이메일 로그인 화면, 뒤로 가기 → 다시 소개 화면
    await page.getByRole('button', { name: '로그인', exact: true }).first().click();
    try {
      await page.getByRole('heading', { name: '다시 만나서 반가워요' }).waitFor({ timeout: 10000 });
      await page.goBack();
      await page.getByRole('heading', { level: 1, name: /한 곳에 모아/ }).waitFor({ timeout: 5000 });
      console.log('✅ 소개 → 로그인 화면 → 뒤로 가기로 소개 화면');
    } catch {
      fail('소개 화면에서 로그인 화면으로 갔다가 뒤로 가기로 돌아와야 함');
    }
    if (errors.length) fail(`로그인 전 화면에서 오류: ${errors.join(' / ')}`);
    else console.log('✅ 로그인 전 화면이 오류 없이 뜸');

    // 알림 링크(?screen=timebox)로 로그아웃 상태에서 들어오면 소개 없이 로그인 화면, 주소는 그대로 (로그인 뒤 그 화면을 열려고)
    await page.goto(`${BASE}/?screen=timebox`);
    try {
      await page.getByRole('heading', { name: '다시 만나서 반가워요' }).waitFor({ timeout: 10000 });
      if (!page.url().includes('screen=timebox')) throw new Error('url changed');
      console.log('✅ 로그아웃 상태로 앱 화면 주소를 열면 로그인 화면이 뜨고 주소가 유지됨');
    } catch {
      fail('?screen=timebox로 들어오면 소개 대신 로그인 화면이 뜨고 주소가 남아 있어야 함');
    }

    // Google 동의 화면에 넣는 개인정보처리방침 주소는 로그인 없이 열려야 함
    await page.goto(`${BASE}/?screen=privacy`);
    try {
      await page.getByRole('heading', { name: '개인정보처리방침' }).waitFor({ timeout: 10000 });
      console.log('✅ 로그인하지 않아도 개인정보처리방침이 열림 (?screen=privacy)');
    } catch {
      fail('로그인 전에 ?screen=privacy로 개인정보처리방침이 보여야 함');
    }
    // 구글 로그인을 취소하고 돌아오면 안내 문구가 보여야 함
    await page.goto(`${BASE}/?error=access_denied&error_description=cancelled`);
    try {
      await page.getByText('Google 로그인이 취소되었습니다.').waitFor({ timeout: 10000 });
      console.log('✅ 구글 로그인 취소 후 돌아오면 안내가 보임');
    } catch {
      fail('구글 로그인 취소 안내가 보여야 함');
    }
    await page.close();
  }

  // 1-2) 가입 없이 둘러보기: 익명 계정이 만들어지고 앱이 열리며 "체험 중" 안내가 보임
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Seoul' });
    await context.addInitScript(() => localStorage.setItem('onboarding-done-00000000-0000-0000-0000-0000000000aa', '1'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await mockSupabase(page, { todoPages: [], timeblockInserts: [] });
    let anonymousSignup = false;
    await page.route(`${SUPABASE}/auth/v1/signup`, async route => {
      anonymousSignup = !JSON.parse(route.request().postData() ?? '{}').email;
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: { providers: [] }, user_metadata: { display_name: '게스트' } };
      return route.fulfill({ json: {
        access_token: fakeJwt({ sub: USER_ID, role: 'authenticated', exp, aud: 'authenticated', is_anonymous: true }),
        refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user,
      } });
    });
    await page.goto(BASE);
    await page.getByRole('button', { name: '가입 없이 둘러보기' }).first().click({ timeout: 10000 });
    try {
      await page.getByText('체험 중이에요. 계정을 만들면', { exact: false }).waitFor({ timeout: 15000 });
      if (!anonymousSignup) fail('둘러보기는 이메일 없는 익명 계정으로 시작해야 함');
      else console.log('✅ 가입 없이 둘러보기: 체험 계정으로 앱이 열리고 계정 만들기 안내가 보임');
    } catch {
      fail('가입 없이 둘러보기를 누르면 앱이 열리고 체험 안내가 보여야 함');
    }
    // 로그인(체험)한 상태에서도 개인정보처리방침 주소는 그 화면으로 열려야 함 (Google 동의 화면 링크)
    await page.goto(`${BASE}/?screen=privacy`);
    try {
      await page.getByRole('heading', { name: '개인정보처리방침' }).waitFor({ timeout: 10000 });
      console.log('✅ 로그인한 상태에서도 ?screen=privacy로 개인정보처리방침이 열림');
    } catch {
      fail('로그인한 상태에서 ?screen=privacy로 개인정보처리방침이 보여야 함');
    }
    if (errors.length) fail(`둘러보기 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 로그인한 상태의 새 브라우저 창
  async function loggedInContext({ settings, fixedTime, viewport = { width: 1280, height: 900 } } = {}) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Seoul', hasTouch: viewport.width < 1024 });
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
    const seen = { todoPages: [], timeblockInserts: [], scheduleUpdates: [] };
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
      // 끝 시간이 있는 일정(14:00~15:30)은 끝 시간 없는 할 일(1시간)보다 1.5배 길게
      const ratio = (await scheduleItem.first().boundingBox()).height / (await todoItem.first().boundingBox()).height;
      if (ratio < 1.3 || ratio > 1.7) throw new Error(`일정 길이 비율 ${ratio.toFixed(2)}`);
      await page.getByText('워크숍').first().waitFor({ timeout: 5000 }); // 어제~내일 일정이 오늘 하루 종일 칸에
      console.log('✅ 타임박스 연동: 10시 할 일, 14~15:30 일정(끝 시간대로), 여러 날 일정, 오늘 D-Day가 타임박스에 보임');
    } catch (e) {
      fail(`시간이 정해진 할 일·일정과 D-Day가 타임박스에 보여야 함 (${e.message})`);
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
      await page.getByText('~15:30').first().waitFor({ timeout: 5000 }); // 일정 끝 시간
      await page.getByRole('button', { name: /기간\s*워크숍/ }).first().waitFor({ timeout: 5000 }); // 어제~내일 일정이 오늘에도
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

  // 7) 폰: 하단 메뉴 4칸, 날짜를 누르면 팝업, 일정 완료 체크 저장, 글자 크기 '크게'가 앱 전체에 적용
  {
    const { context, page, errors, seen } = await loggedInContext({ settings: { calendar_text_size: 'large' }, viewport: { width: 390, height: 844 } });
    await page.goto(BASE);
    try {
      await page.getByRole('heading', { name: '오늘 할 일' }).waitFor({ timeout: 15000 });
      const fs = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs').trim());
      if (fs !== '1.15') throw new Error(`글자 크기 배율이 1.15가 아님: ${fs}`);
      const bottomNav = page.locator('nav[aria-label="주요 메뉴"]').last();
      const labels = (await bottomNav.getByRole('button').allTextContents()).map(t => t.trim());
      if (labels.join(',') !== '홈,달력,메모,설정') throw new Error(`하단 메뉴: ${labels.join(',')}`);
      await bottomNav.getByRole('button', { name: '달력' }).click();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
      await page.getByRole('button', { name: new RegExp(`^${Number(today.slice(5, 7))}월 ${Number(today.slice(8, 10))}일`) }).first().click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('button', { name: '일정', exact: false }).first().waitFor({ timeout: 5000 }); // 팝업 안 "+ 일정"
      await sheet.getByText('치과 예약').waitFor({ timeout: 5000 });
      await sheet.getByRole('button', { name: '일정 완료', exact: true }).first().click();
      for (let i = 0; i < 20 && seen.scheduleUpdates.length === 0; i++) await page.waitForTimeout(100);
      if (!seen.scheduleUpdates.some(w => w.includes('"completed":true'))) throw new Error(`일정 완료가 저장되지 않음: ${seen.scheduleUpdates.join(' / ')}`);
      await sheet.getByRole('button', { name: '일정 완료 취소' }).first().waitFor({ timeout: 5000 });
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/calendar-day-sheet-mobile.png` });
      console.log('✅ 폰: 하단 메뉴 4칸, 날짜를 누르면 팝업이 뜨고 일정 완료 체크가 저장됨, 글자 크기 크게 적용');
    } catch (e) {
      fail(`폰 달력 팝업·일정 완료·글자 크기 (${e.message})`);
    }
    if (errors.length) fail(`폰 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 8) 태블릿 타임박스: 블록을 꾹 눌러 다른 요일 칸으로 끌어도 놓으면 저장됨
  //    (다른 칸으로 옮겨 그려지면서 처음 누른 요소가 화면에서 떨어져도 손을 뗀 것을 놓치지 않아야 함)
  {
    const { context, page, errors } = await loggedInContext({ viewport: { width: 810, height: 1080 } });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const block = {
      id: 'tb-drag', user_id: USER_ID, title: '집중 작업', todo_id: null, color: null,
      start_at: new Date(`${today}T09:00:00+09:00`).toISOString(), end_at: new Date(`${today}T10:30:00+09:00`).toISOString(),
      completed: false, remind_minutes: null, notified_at: null, series_id: null, created_at: '2026-01-01T00:00:00Z',
    };
    const patches = [];
    await page.route(`${SUPABASE}/rest/v1/timeblocks**`, route => {
      const m = route.request().method();
      if (m === 'GET') return route.fulfill({ json: [block] });
      if (m === 'PATCH') patches.push(route.request().postData() ?? '');
      return route.fulfill({ json: [] });
    });
    await page.goto(`${BASE}/?screen=timebox`);
    try {
      const el = page.locator('[data-block]').filter({ hasText: '집중 작업' }).first();
      await el.waitFor({ timeout: 15000 });
      await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox();
      const cdp = await context.newCDPSession(page);
      const x = box.x + box.width / 2, y = box.y + 20;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await page.waitForTimeout(600); // 꾹 누르기
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 9, y }] });
        await page.waitForTimeout(30);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      for (let i = 0; i < 20 && patches.length === 0; i++) await page.waitForTimeout(100);
      const moved = patches.map(p => JSON.parse(p)).find(p => p.start_at && p.start_at !== block.start_at);
      if (!moved) throw new Error(`옮긴 위치가 저장되지 않음 (${patches.join(' / ') || '요청 없음'})`);
      if (new Date(moved.start_at).getTime() - new Date(block.start_at).getTime() < 20 * 3600 * 1000) throw new Error(`다른 날로 옮겨지지 않음: ${moved.start_at}`);
      console.log('✅ 태블릿 타임박스: 꾹 눌러 다른 요일로 끌어 놓으면 저장됨');
    } catch (e) {
      fail(`태블릿 타임박스 요일 넘겨 끌기 (${e.message})`);
    }
    if (errors.length) fail(`태블릿 타임박스 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 9) 검색 → 메모 열기 → 마크다운 (링크는 새 창, 주소 뒤 한글은 링크에서 빠짐, 체크리스트는 눌러서 체크)
  {
    const { context, page, errors } = await loggedInContext();
    const note = {
      id: 'note-md', user_id: USER_ID, title: '회의 준비', folder_id: null, pinned: false,
      content: '## 안건\n- [ ] 자료 공유\n- 참고 https://example.com에서 확인',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-03T00:00:00Z',
    };
    const notePatches = [];
    await page.route(`${SUPABASE}/rest/v1/notes**`, route => {
      const m = route.request().method();
      if (m === 'GET') return route.fulfill({ json: [note] });
      if (m === 'PATCH') notePatches.push(route.request().postData() ?? '');
      return route.fulfill({ json: [] });
    });
    await page.goto(BASE);
    try {
      await page.getByRole('heading', { name: '오늘 할 일' }).waitFor({ timeout: 15000 });
      await page.keyboard.press('Control+k');
      const box = page.getByRole('dialog', { name: '검색' });
      await box.getByRole('searchbox', { name: '검색어' }).fill('ㅎㅇ ㅈㅂ');
      await box.getByRole('option').filter({ hasText: '회의 준비' }).waitFor({ timeout: 5000 });
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: '안건' }).waitFor({ timeout: 10000 });
      const link = page.locator('.md a').first();
      if (!/^https:\/\/example\.com\/?$/.test(await link.getAttribute('href') ?? '') || await link.getAttribute('target') !== '_blank') throw new Error(`링크: ${await link.getAttribute('href')} ${await link.textContent()}`);
      await page.locator('.md').getByRole('checkbox').first().click();
      for (let i = 0; i < 30 && !notePatches.some(p => p.includes('[x] 자료 공유')); i++) await page.waitForTimeout(100);
      if (!notePatches.some(p => p.includes('[x] 자료 공유'))) throw new Error(`체크가 저장되지 않음: ${notePatches.join(' / ') || '요청 없음'}`);
      console.log('✅ 검색: Ctrl+K·초성으로 메모를 찾아 열고, 마크다운 링크(새 창)·체크리스트 체크가 저장됨');
    } catch (e) {
      fail(`검색·마크다운 메모 (${e.message})`);
    }
    if (errors.length) fail(`검색·메모 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 10) 오프라인 저장
  {
    const { context, page, errors } = await loggedInContext();
    const writes = [];
    await page.route(`${SUPABASE}/rest/v1/todos**`, route => {
      const m = route.request().method();
      if (m === 'GET') return route.fallback();
      writes.push(`${m} ${route.request().postData() ?? ''}`);
      const body = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({ status: 201, json: Array.isArray(body) ? body : [body] });
    });
    await page.goto(BASE);
    try {
      await page.getByRole('heading', { name: '오늘 할 일' }).waitFor({ timeout: 15000 });
      await page.getByText(`할 일 ${TOTAL_TODOS}`, { exact: true }).first().waitFor({ timeout: 15000 });
      await context.setOffline(true);
      await page.getByRole('button', { name: '완료 처리' }).first().click();
      await page.getByRole('button', { name: /에 할 일 추가/ }).first().click();
      const sheet = page.getByRole('dialog', { name: '할 일 추가' });
      const pick = sheet.getByRole('button', { name: /공부/ });
      if (await pick.count()) await pick.first().click();
      await sheet.getByPlaceholder('할 일을 적어주세요').fill('비행기에서 적은 일');
      await sheet.getByPlaceholder('할 일을 적어주세요').press('Enter');
      await page.keyboard.press('Escape');
      await page.getByText('비행기에서 적은 일').first().waitFor({ timeout: 5000 });
      await page.getByText('(2개 대기)', { exact: false }).first().waitFor({ timeout: 5000 });
      if (writes.length) throw new Error(`끊긴 동안 요청이 나감: ${writes.join(' / ')}`);
      await context.setOffline(false);
      for (let i = 0; i < 50 && writes.length < 2; i++) await page.waitForTimeout(100);
      if (writes.length !== 2 || !writes[0].startsWith('PATCH') || !writes[0].includes('"completed":true') || !writes[1].startsWith('POST') || !writes[1].includes('"id":')) {
        throw new Error(`다시 연결된 뒤 저장 순서/내용이 다름: ${writes.join(' / ')}`);
      }
      await page.getByText('오프라인에서 바꾼 내용을 모두 저장했어요').waitFor({ timeout: 5000 });
      console.log('✅ 오프라인: 끊긴 동안 체크·추가가 화면에 남고, 다시 연결되면 순서대로 저장됨');
    } catch (e) {
      fail(`오프라인 저장 (${e.message})`);
    }
    if (errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|WebSocket/.test(e)).length) fail(`오프라인 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  // 11) 밀린 할 일: 매일 반복은 가장 최근에 놓친 한 번만, '안 하기' 저장
  {
    const { context, page, errors } = await loggedInContext();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const shift = (days) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    const base = { user_id: USER_ID, completed: false, category_id: null, subcategory_id: null, due_date: null, is_dday: false, start_time: null, notes: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    const rows = [
      { ...base, id: 'r1', title: '스트레칭', date: shift(-3), series_id: 's-daily' },
      { ...base, id: 'r2', title: '스트레칭', date: shift(-2), series_id: 's-daily' },
      { ...base, id: 'r3', title: '스트레칭', date: shift(-1), series_id: 's-daily' },
      { ...base, id: 'o1', title: '서류 제출', date: shift(-2), series_id: null },
    ];
    const patches = [];
    await page.route(`${SUPABASE}/rest/v1/todos**`, route => {
      const m = route.request().method();
      if (m === 'GET') return route.fulfill({ json: new URL(route.request().url()).searchParams.get('offset') === '0' || !new URL(route.request().url()).searchParams.get('offset') ? rows : [] });
      if (m === 'PATCH') patches.push(`${new URL(route.request().url()).searchParams.get('id')} ${route.request().postData()}`);
      return route.fulfill({ status: 204, body: '' });
    });
    await page.goto(BASE);
    try {
      await page.getByRole('heading', { name: '오늘 할 일' }).waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: /밀린 할 일/ }).first().click();
      const dlg = page.getByRole('dialog', { name: '밀린 할 일' });
      await dlg.getByText('서류 제출').waitFor({ timeout: 5000 });
      const repeats = await dlg.getByText('스트레칭').count();
      if (repeats !== 1) throw new Error(`반복 할 일이 ${repeats}번 보임 (1번이어야 함)`);
      await dlg.locator('li').filter({ hasText: '서류 제출' }).getByRole('button', { name: /안 하기/ }).click();
      for (let i = 0; i < 20 && patches.length === 0; i++) await page.waitForTimeout(100);
      if (!patches.some(p => p.startsWith('eq.o1') && p.includes('"skipped":true'))) throw new Error(`안 하기가 저장되지 않음: ${patches.join(' / ')}`);
      console.log('✅ 밀린 할 일: 반복은 가장 최근 한 번만 보이고, 안 하기가 저장됨');
    } catch (e) {
      fail(`밀린 할 일 정리 (${e.message})`);
    }
    if (errors.length) fail(`밀린 할 일 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  await browser.close();
} finally {
  server.kill();
}
