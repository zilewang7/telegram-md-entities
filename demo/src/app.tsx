import { useCallback, useMemo, useState } from 'react';
import { LocaleSwitch } from './components/locale-switch';
import { PlatformPicker } from './components/platform-picker';
import { TabSwitch } from './components/tab-switch';
import type { PanelId } from './components/tab-switch';
import { channelPlanOf } from './core/platform-channel';
import type { ClientPlatform } from './core/types';
import { useI18n } from './i18n/i18n-context';
import { detectClipboardCapabilities, detectClientPlatform } from './lib/platform';
import { AboutPanel } from './pages/about/about-panel';
import { ForwardPanel } from './pages/forward/forward-panel';
import { ReversePanel } from './pages/reverse/reverse-panel';

const GITHUB_URL = 'https://github.com/zilewang7/telegram-md-entities';
const NPM_URL = 'https://www.npmjs.com/package/telegram-md-entities';
const HOME_URL = 'https://zile.wang';

export const App = () => {
  const { t } = useI18n();
  const [panel, setPanel] = useState<PanelId>('forward');
  const [platform, setPlatform] = useState<ClientPlatform>(detectClientPlatform);
  const capabilities = useMemo(detectClipboardCapabilities, []);
  const plan = useMemo(
    () => channelPlanOf(platform, capabilities.htmlSupported),
    [platform, capabilities.htmlSupported],
  );

  const handlePanelChange = useCallback((next: PanelId) => setPanel(next), []);
  const handlePlatformChange = useCallback((next: ClientPlatform) => setPlatform(next), []);

  return (
    <div className="page">
      <header className="app-header">
        <div className="app-header-top">
          <span className="app-kicker">{t('app.kicker')}</span>
          <LocaleSwitch />
        </div>
        <h1 className="app-title">{t('app.title')}</h1>
        <p className="app-subtitle">{t('app.subtitle')}</p>
        <div className="app-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            {t('app.link.github')}
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer">
            {t('app.link.npm')}
          </a>
          <a href={HOME_URL} target="_blank" rel="noreferrer">
            {t('app.link.site')}
          </a>
        </div>
      </header>

      <TabSwitch value={panel} onChange={handlePanelChange} />
      <PlatformPicker value={platform} onChange={handlePlatformChange} />

      <main>
        <div className="panel-stack" hidden={panel !== 'forward'}>
          <ForwardPanel plan={plan} />
        </div>
        <div className="panel-stack" hidden={panel !== 'reverse'}>
          <ReversePanel plan={plan} platform={platform} readSupported={capabilities.readSupported} />
        </div>
        <div className="panel-stack" hidden={panel !== 'about'}>
          <AboutPanel platform={platform} />
        </div>
      </main>

      <footer className="app-footer">
        <span>{t('app.footer.drivenBy')}</span>
        <span>{t('app.footer.tips')}</span>
      </footer>
    </div>
  );
};
