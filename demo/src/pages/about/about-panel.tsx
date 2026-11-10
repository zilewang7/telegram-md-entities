import type { ClientPlatform } from '../../core/types';
import { HowItWorks } from './how-it-works';
import { KnownLimitations } from './limitations';
import { LibraryIntro } from './library-intro';
import { PlatformMatrix } from './platform-matrix';
import { SyntaxSupport } from './syntax-support';
import './about.css';

interface AboutPanelProps {
  platform: ClientPlatform;
}

/**
 * The "learn more" tab: what each Telegram client can actually do, the
 * clipboard mechanics behind the two directions, the library that powers them,
 * the supported markdown dialect and the known limits.
 */
export const AboutPanel = ({ platform }: AboutPanelProps) => (
  <>
    <PlatformMatrix platform={platform} />
    <HowItWorks />
    <LibraryIntro />
    <SyntaxSupport />
    <KnownLimitations />
  </>
);
