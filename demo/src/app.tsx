import { useCallback, useMemo, useState } from 'react';
import { PlatformPicker } from './components/platform-picker';
import { TabSwitch } from './components/tab-switch';
import type { PanelId } from './components/tab-switch';
import { channelPlanOf } from './core/platform-channel';
import type { ClientPlatform } from './core/types';
import { detectClipboardCapabilities, detectClientPlatform } from './lib/platform';
import { AboutPanel } from './pages/about/about-panel';
import { ForwardPanel } from './pages/forward/forward-panel';
import { ReversePanel } from './pages/reverse/reverse-panel';

const GITHUB_URL = 'https://github.com/zilewang7/telegram-md-entities';
const NPM_URL = 'https://www.npmjs.com/package/telegram-md-entities';
const HOME_URL = 'https://zile.wang';

export const App = () => {
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
        <span className="app-kicker">Telegram · Markdown</span>
        <h1 className="app-title">Telegram 富文本剪贴板</h1>
        <p className="app-subtitle">
          把 Markdown 变成能直接粘进 Telegram 输入框的富文本，或者把 Telegram 消息还原成 Markdown。
          全部在你的浏览器里完成，内容不会上传。
        </p>
        <div className="app-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer">
            npm
          </a>
          <a href={HOME_URL} target="_blank" rel="noreferrer">
            zile.wang
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
        <span>由 telegram-md-entities 驱动 · 内容只在本地处理，不上传服务器</span>
        <span>iOS 首次粘贴可能弹系统授权提示；Android 13+ 会显示剪贴板预览，属系统行为。</span>
      </footer>
    </div>
  );
};
