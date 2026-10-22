import React from 'react';
import {
  Sparkles,
  Languages,
  Headphones,
  Users,
  Zap,
  AudioLines,
  Search,
  X,
  ChevronRight,
  Sun,
  Moon,
  Terminal,
  Code2,
  Layers,
  Bookmark,
  RefreshCw,
  CheckCircle2,
  User,
  Download,
  Loader2,
  AlertCircle,
  Pause,
  Play,
  Copy,
  Check,
  ListMusic,
  RotateCcw,
  Activity,
  FileText,
  Paperclip,
  MicOff,
  Mic,
  Radio,
  Volume2,
  Network,
  Palette,
  SearchX,
  CornerDownLeft,
  BookOpen,
  Trash2,
  BookmarkPlus,
  Sliders,
  Globe,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';

export interface GoogleIconProps {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  className?: string;
  title?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  auto_awesome: Sparkles,
  translate: Languages,
  headphones: Headphones,
  group: Users,
  bolt: Zap,
  record_voice_over: AudioLines,
  search: Search,
  close: X,
  chevron_right: ChevronRight,
  light_mode: Sun,
  dark_mode: Moon,
  terminal: Terminal,
  code: Code2,
  style: Layers,
  bookmark: Bookmark,
  sync: RefreshCw,
  check_circle: CheckCircle2,
  person: User,
  download: Download,
  progress_activity: Loader2,
  error: AlertCircle,
  pause: Pause,
  play_arrow: Play,
  content_copy: Copy,
  check: Check,
  queue_music: ListMusic,
  replay: RotateCcw,
  graphic_eq: Activity,
  description: FileText,
  attach_file: Paperclip,
  mic_off: MicOff,
  mic: Mic,
  podcasts: Radio,
  volume_up: Volume2,
  account_tree: Network,
  mic_none: Mic,
  palette: Palette,
  search_off: SearchX,
  keyboard_return: CornerDownLeft,
  menu_book: BookOpen,
  delete: Trash2,
  article: FileText,
  bookmark_add: BookmarkPlus,
  tune: Sliders,
  language: Globe,
};

/**
 * Sistema vetorial de ícones SVG de precisão (Lucide stroke-width 1.75)
 * Substitui fontes de ligatura genéricas/embaçadas por vetores nítidos.
 */
export const GoogleIcon: React.FC<GoogleIconProps> = ({
  name,
  size = 18,
  filled = false,
  className = '',
  title,
}) => {
  const IconComponent = ICON_MAP[name] ?? CircleDot;
  const shouldFill = filled && (name === 'play_arrow' || name === 'pause');

  return (
    <span
      className={`inline-flex items-center justify-center select-none shrink-0 leading-none align-middle ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
      title={title}
      data-state="idle"
      aria-busy="false"
      aria-hidden={title ? undefined : 'true'}
    >
      <IconComponent
        size={size}
        strokeWidth={1.75}
        className={shouldFill ? 'fill-current' : undefined}
      />
    </span>
  );
};
