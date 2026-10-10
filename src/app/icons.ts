import play from '@phosphor-icons/core/assets/fill/play-fill.svg';
import pause from '@phosphor-icons/core/assets/fill/pause-fill.svg';
import replay from '@phosphor-icons/core/assets/bold/arrow-counter-clockwise-bold.svg';
import pin from '@phosphor-icons/core/assets/fill/map-pin-fill.svg';
import share from '@phosphor-icons/core/assets/bold/share-network-bold.svg';
import globe from '@phosphor-icons/core/assets/bold/globe-simple-bold.svg';
import sun from '@phosphor-icons/core/assets/bold/sun-bold.svg';
import moon from '@phosphor-icons/core/assets/bold/moon-bold.svg';
import search from '@phosphor-icons/core/assets/bold/magnifying-glass-bold.svg';
import close from '@phosphor-icons/core/assets/bold/x-bold.svg';
import locate from '@phosphor-icons/core/assets/bold/crosshair-simple-bold.svg';
import list from '@phosphor-icons/core/assets/bold/list-bullets-bold.svg';
import info from '@phosphor-icons/core/assets/bold/info-bold.svg';
import caret from '@phosphor-icons/core/assets/bold/caret-down-bold.svg';
import download from '@phosphor-icons/core/assets/bold/download-simple-bold.svg';
import link from '@phosphor-icons/core/assets/bold/link-simple-bold.svg';
import video from '@phosphor-icons/core/assets/bold/video-camera-bold.svg';
import github from '@phosphor-icons/core/assets/bold/github-logo-bold.svg';
import speakerHigh from '@phosphor-icons/core/assets/bold/speaker-high-bold.svg';
import speakerSlash from '@phosphor-icons/core/assets/bold/speaker-slash-bold.svg';
import warning from '@phosphor-icons/core/assets/bold/warning-circle-bold.svg';
import { svg } from './dom.ts';

const ICONS = {
  play,
  pause,
  replay,
  pin,
  share,
  globe,
  sun,
  moon,
  search,
  close,
  locate,
  list,
  info,
  caret,
  download,
  link,
  video,
  github,
  warning,
  speakerHigh,
  speakerSlash,
};

export type IconName = keyof typeof ICONS;

export const icon = (name: IconName): SVGElement => svg(ICONS[name]);
