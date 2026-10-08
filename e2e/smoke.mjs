// ============================================================
// 화면 스모크 테스트 (Playwright, 실제 Supabase 없이)
//
// 1) 로그인 전: 로그인 화면이 오류 없이 뜨는지
// 2) 로그인 후: 할 일이 1,000개를 넘어도 끝까지 불러오는지 (Supabase API를 흉내 내서 2,345개를 돌려줌)
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
async function mockSupabase(page, seen) {
  const today = new Date().toISOString().slice(0, 10);
  const todos = Array.from({ length: TOTAL_TODOS }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    user_id: USER_ID, title: `할 일 ${i + 1}`, completed: false, category_id: null, subcategory_id: null,
    date: i === TOTAL_TODOS - 1 ? today : null, due_date: null, is_dday: false, start_time: null, notes: null,
    sort_order: i, series_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }));
  const settings = {
    user_id: USER_ID, theme: 'light', default_screen: 'today', notifications: false, list_sort_by: 'manual',
    hide_completed: false, hidden_category_ids: [], calendar_text_size: 'medium', updated_at: '2026-01-01T00:00:00Z',
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

  // 2) 로그인 후 - 1,000개가 넘는 할 일
  {
    const context = await browser.newContext();
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
    const seen = { todoPages: [] };
    await mockSupabase(page, seen);
    await page.goto(BASE);
    // 화면 크기에 따라 숨겨진 쪽 목록에 있을 수 있어서 "화면에 그려졌는지"만 확인
    await page.getByText(`할 일 ${TOTAL_TODOS}`, { exact: true }).first().waitFor({ state: 'attached', timeout: 15000 });

    const firstLoad = [...new Set(seen.todoPages)].sort((a, b) => a - b);
    if (firstLoad.join(',') !== '0,1000,2000') fail(`할 일을 1,000개씩 나눠 끝까지 받아야 함 (받은 위치: ${firstLoad.join(',')})`);
    else console.log(`✅ 할 일 ${TOTAL_TODOS}개를 3번에 나눠 끝까지 불러옴 (마지막 할 일까지 화면에 그려짐)`);
    if (errors.length) fail(`로그인 후 화면에서 오류: ${errors.join(' / ')}`);
    await context.close();
  }

  await browser.close();
} finally {
  server.kill();
}
