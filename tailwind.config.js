/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
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
        // 일정(시간이 정해진 이벤트) 색 - 초록과 어울리는 차분한 슬레이트 블루
        blue: {
          50: '#F0F4F9',
          100: '#E0E8F3',
          200: '#C2D1E7',
          300: '#98B1D5',
          400: '#6E90C0',
          500: '#4F73A8',
          600: '#3F5E8E',
          700: '#344C73',
          800: '#2A3C5B',
          900: '#1E2B41',
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
  plugins: [],
}
