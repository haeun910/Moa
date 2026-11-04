// 글자 크기 배율(--fs)을 곱한 크기
const fs = size => `calc(${size} * var(--fs, 1))`
// 화면에서 쓰는 px 글자 크기들 (새 크기가 필요하면 여기에 추가)
const PX_SIZES = [9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 17, 22, 26, 28, 40, 46]

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // 글자 크기: 설정 > 글자 크기(작게/보통/크게)에 따라 앱 전체 글자가 같은 비율로 커지고 작아지도록
      // 모든 글자 크기에 --fs(배율, 기본 1)를 곱함. 여백·칸 크기는 그대로 두고 글자만 바뀜.
      // text-xs 같은 기본 크기 + text-13px 같은 px 크기(예전 text-[13px] 대신 이걸 씀)
      fontSize: {
        xs: [fs('0.75rem'), { lineHeight: fs('1rem') }],
        sm: [fs('0.875rem'), { lineHeight: fs('1.25rem') }],
        base: [fs('1rem'), { lineHeight: fs('1.5rem') }],
        lg: [fs('1.125rem'), { lineHeight: fs('1.75rem') }],
        xl: [fs('1.25rem'), { lineHeight: fs('1.75rem') }],
        '2xl': [fs('1.5rem'), { lineHeight: fs('2rem') }],
        '3xl': [fs('1.875rem'), { lineHeight: fs('2.25rem') }],
        '4xl': [fs('2.25rem'), { lineHeight: fs('2.5rem') }],
        '5xl': [fs('3rem'), { lineHeight: '1' }],
        ...Object.fromEntries(PX_SIZES.map(n => [`${n}px`, fs(`${n}px`)])),
      },
      // 오프라인·저장 대기 안내 띠가 위에 떠 있을 때는 그 높이(--strip-h, Toaster가 정함)만큼 뺀 화면 높이
      height: { screen: 'calc(100vh - var(--strip-h, 0px))' },
      minHeight: { screen: 'calc(100vh - var(--strip-h, 0px))' },
      // 사이드바를 이름까지 펼쳐도 달력이 답답하지 않은 너비 (14인치 노트북 이상)
      screens: { wide: '1400px' },
      fontFamily: {
        sans: [
          '"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui',
          '"Apple SD Gothic Neo"', '"Noto Sans KR"', '"Malgun Gothic"', 'sans-serif',
        ],
      },
      colors: {
        // 브랜드 초록 (500 = 로고 색). 버튼처럼 흰 글씨가 올라가는 면은 600 이상을 사용
        leaf: {
          50: '#F5F8EC',
          100: '#EAF0D7',
          200: '#D7E3B2',
          300: '#BFD388',
          400: '#A2BD5B',
          500: '#86A03F',
          600: '#5F7A27',
          700: '#4B6120',
          800: '#3A4B1A',
          900: '#283412',
          950: '#171E0A',
        },
        // 앱 전체 무채색을 초록 기운이 살짝 도는 세이지 톤으로 통일
        gray: {
          50: '#F7F8F5',
          100: '#EFF1EB',
          200: '#E2E5DC',
          300: '#CACFC3',
          400: '#9DA397',
          500: '#737A6F',
          600: '#575E53',
          700: '#40453D',
          800: '#2A2E27',
          900: '#1B1E19',
          950: '#111310',
        },
        // 일정(시간이 정해진 이벤트) 색 - 화면을 단색 위주로 정리하면서 파랑 대신 먹색(진한 무채색)
        ink: {
          50: '#F3F4F2',
          100: '#E9EBE6',
          200: '#D6D9D2',
          300: '#B4B9AF',
          400: '#8B9186',
          500: '#61675D',
          600: '#4B5148',
          700: '#3A3F37',
          800: '#2A2E27',
          900: '#1B1E19',
        },
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(27 30 25 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(27 30 25 / 0.07), 0 1px 2px -1px rgb(27 30 25 / 0.05)',
        md: '0 4px 12px -2px rgb(27 30 25 / 0.08), 0 2px 4px -2px rgb(27 30 25 / 0.05)',
        lg: '0 12px 24px -6px rgb(27 30 25 / 0.10), 0 4px 8px -4px rgb(27 30 25 / 0.05)',
        xl: '0 20px 40px -12px rgb(27 30 25 / 0.16), 0 6px 12px -6px rgb(27 30 25 / 0.06)',
        '2xl': '0 32px 64px -16px rgb(27 30 25 / 0.24)',
        // 카드: 아주 옅은 테두리 + 그림자를 한 번에 (border 없이도 경계가 보이게)
        card: '0 0 0 1px rgb(27 30 25 / 0.06), 0 1px 2px 0 rgb(27 30 25 / 0.04)',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(12px) scale(0.985)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'slide-in-bottom': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in-bottom': 'slide-in-bottom 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.18s ease-out',
      },
    },
  },
  plugins: [
    // can-hover: 마우스가 있는 기기에서만 (터치 화면에서는 "올려야 보이는" 버튼이 안 보이는 문제 방지)
    ({ addVariant }) => addVariant('can-hover', '@media (hover: hover) and (pointer: fine)'),
  ],
}
