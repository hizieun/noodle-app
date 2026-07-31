// 인라인 SVG 아이콘 (Lucide 스타일, currentColor 상속) — UI 컨트롤 이모지 대체.
// 음식 카테고리 이모지·브랜드 탭(🏮🌙)·별점(★)은 정체성이라 유지.
const Svg = ({ children, size = 20, fill = 'none', ...p }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...p}>{children}</svg>
);

export const HeartIcon = ({ filled, ...p }) => (
  <Svg fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </Svg>
);
export const XIcon = (p) => (<Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
export const CheckIcon = (p) => (<Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>);
export const MapPinIcon = (p) => (
  <Svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>
);
export const MapIcon = (p) => (
  <Svg {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></Svg>
);
export const ListIcon = (p) => (
  <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>
);
export const SparklesIcon = (p) => (
  <Svg {...p}><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3Z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" /></Svg>
);
export const LinkIcon = (p) => (
  <Svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></Svg>
);
export const MessageIcon = (p) => (
  <Svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" /></Svg>
);
export const ShuffleIcon = (p) => (
  <Svg {...p}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></Svg>
);
export const SearchIcon = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>
);
