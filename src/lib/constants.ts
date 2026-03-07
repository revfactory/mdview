import type { BlockType, SlashCommandItem } from '@/types/editor';
import type { AppSettings } from '@/types';

export const BLOCK_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: 'paragraph', label: '본문', icon: 'Type' },
  { type: 'heading1', label: '제목 1', icon: 'Heading1' },
  { type: 'heading2', label: '제목 2', icon: 'Heading2' },
  { type: 'heading3', label: '제목 3', icon: 'Heading3' },
  { type: 'heading4', label: '제목 4', icon: 'Heading4' },
  { type: 'heading5', label: '제목 5', icon: 'Heading5' },
  { type: 'heading6', label: '제목 6', icon: 'Heading6' },
  { type: 'bulletList', label: '글머리 기호 목록', icon: 'List' },
  { type: 'orderedList', label: '번호 목록', icon: 'ListOrdered' },
  { type: 'taskList', label: '체크리스트', icon: 'ListChecks' },
  { type: 'blockquote', label: '인용문', icon: 'Quote' },
  { type: 'codeBlock', label: '코드 블록', icon: 'Code' },
  { type: 'table', label: '표', icon: 'Table' },
  { type: 'image', label: '이미지', icon: 'Image' },
  { type: 'horizontalRule', label: '구분선', icon: 'Minus' },
  { type: 'math', label: '수식', icon: 'Sigma' },
  { type: 'mermaid', label: '다이어그램', icon: 'GitBranch' },
];

export const SLASH_COMMANDS: SlashCommandItem[] = [
  { label: '제목 1', description: '큰 제목', icon: 'Heading1', command: 'heading1', aliases: ['h1'], group: '기본 블록' },
  { label: '제목 2', description: '중간 제목', icon: 'Heading2', command: 'heading2', aliases: ['h2'], group: '기본 블록' },
  { label: '제목 3', description: '작은 제목', icon: 'Heading3', command: 'heading3', aliases: ['h3'], group: '기본 블록' },
  { label: '글머리 기호 목록', description: '간단한 목록', icon: 'List', command: 'bulletList', aliases: ['ul', 'bullet'], group: '기본 블록' },
  { label: '번호 목록', description: '순서가 있는 목록', icon: 'ListOrdered', command: 'orderedList', aliases: ['ol', 'number'], group: '기본 블록' },
  { label: '체크리스트', description: '할 일 목록', icon: 'ListChecks', command: 'taskList', aliases: ['todo', 'task', 'check'], group: '기본 블록' },
  { label: '인용문', description: '인용 블록', icon: 'Quote', command: 'blockquote', aliases: ['quote'], group: '기본 블록' },
  { label: '구분선', description: '가로 구분선', icon: 'Minus', command: 'horizontalRule', aliases: ['hr', 'divider'], group: '기본 블록' },
  { label: '코드 블록', description: '코드 작성', icon: 'Code', command: 'codeBlock', aliases: ['code', 'pre'], group: '미디어' },
  { label: '표', description: '표 삽입', icon: 'Table', command: 'table', aliases: ['table'], group: '미디어' },
  { label: '이미지', description: '이미지 삽입', icon: 'Image', command: 'image', aliases: ['img'], group: '미디어' },
  { label: '수식', description: 'LaTeX 수식', icon: 'Sigma', command: 'math', aliases: ['latex', 'katex'], group: '고급' },
  { label: '다이어그램', description: 'Mermaid 다이어그램', icon: 'GitBranch', command: 'mermaid', aliases: ['diagram', 'chart'], group: '고급' },
];

export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  'Mod-b': '굵게',
  'Mod-i': '기울임',
  'Mod-u': '밑줄',
  'Mod-Shift-x': '취소선',
  'Mod-e': '인라인 코드',
  'Mod-k': '링크',
  'Mod-s': '저장',
  'Mod-z': '실행 취소',
  'Mod-Shift-z': '다시 실행',
  'Mod-a': '전체 선택',
  'Mod-Shift-1': '제목 1',
  'Mod-Shift-2': '제목 2',
  'Mod-Shift-3': '제목 3',
  'Mod-Shift-4': '제목 4',
  'Mod-Shift-5': '제목 5',
  'Mod-Shift-6': '제목 6',
  'Mod-Shift-7': '번호 목록',
  'Mod-Shift-8': '글머리 기호 목록',
  'Mod-Shift-9': '체크리스트',
  'Mod-Shift-b': '인용문',
  'Mod-Alt-c': '코드 블록',
  'Mod-Enter': '구분선',
  'Mod-n': '새 문서',
  'Mod-p': '빠른 검색',
  'Mod-\\': '사이드바 토글',
  'Mod-/': '슬래시 명령어',
};

export const FOLDER_COLORS: { label: string; value: string }[] = [
  { label: '회색', value: '#6B7280' },
  { label: '빨강', value: '#EF4444' },
  { label: '주황', value: '#F97316' },
  { label: '노랑', value: '#EAB308' },
  { label: '초록', value: '#22C55E' },
  { label: '파랑', value: '#3B82F6' },
  { label: '남색', value: '#6366F1' },
  { label: '보라', value: '#A855F7' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  theme: 'system',
  editorFontSize: 16,
  editorFontFamily: 'pretendard',
  editorLineHeight: 1.75,
  editorMaxWidth: 800,
  showLineNumbers: false,
  autosaveInterval: 1000,
  defaultViewMode: 'wysiwyg',
  sidebarWidth: 280,
  spellCheck: true,
  lastOpenDocumentId: null,
};

export const MAX_TITLE_LENGTH = 200;
export const MAX_FOLDER_NAME_LENGTH = 100;
export const MAX_FOLDER_DEPTH = 3;
export const EXCERPT_MAX_LENGTH = 200;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 24;
export const MIN_LINE_HEIGHT = 1.4;
export const MAX_LINE_HEIGHT = 2.2;
export const MIN_EDITOR_WIDTH = 600;
export const MAX_EDITOR_WIDTH = 1200;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 400;
