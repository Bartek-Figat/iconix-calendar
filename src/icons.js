// Every icon in the calendar comes from @iconix/icons (https://bartek-figat.github.io/iconix-site/).
// The tree-shakable "lite" entry is used, so only these icons end up in your bundle.
import {
  toSvg,
  iconChevronLeft, iconChevronRight, iconSearch, iconPlus, iconMinus, iconClose, iconTrash, iconCopy,
  iconRepeat, iconClock, iconMapPin, iconCalendar, iconSparkles, iconUndo, iconRedo, iconAlertTriangle,
  iconSidebar, iconDownload, iconUpload, iconCheck, iconCommand, iconList, iconGrid, iconUsers, iconSun,
  iconMoon, iconFileText, iconZap, iconLayers, iconEye, iconKeyboard, iconType, iconPalette, iconTimeline,
  iconArrowRight, iconCoffee, iconPackage,
} from '@iconix/icons/lite';

export const ICONS = {
  'chevron-left': iconChevronLeft,
  'chevron-right': iconChevronRight,
  search: iconSearch,
  plus: iconPlus,
  minus: iconMinus,
  x: iconClose,
  trash: iconTrash,
  copy: iconCopy,
  repeat: iconRepeat,
  clock: iconClock,
  pin: iconMapPin,
  calendar: iconCalendar,
  sparkles: iconSparkles,
  undo: iconUndo,
  redo: iconRedo,
  alert: iconAlertTriangle,
  sidebar: iconSidebar,
  download: iconDownload,
  upload: iconUpload,
  check: iconCheck,
  command: iconCommand,
  list: iconList,
  grid: iconGrid,
  users: iconUsers,
  sun: iconSun,
  moon: iconMoon,
  note: iconFileText,
  zap: iconZap,
  layers: iconLayers,
  eye: iconEye,
  keyboard: iconKeyboard,
  type: iconType,
  palette: iconPalette,
  timeline: iconTimeline,
  arrow: iconArrowRight,
  coffee: iconCoffee,
  box: iconPackage,
};

export function icon(name, size = 16) {
  const data = ICONS[name];
  if (!data) return '';
  return toSvg(data, { size, className: 'ixc-i' });
}
