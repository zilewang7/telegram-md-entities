import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ClientPlatform } from '../../core/types';

/** One row per client, plus the page itself running in a plain browser */
type MatrixRowId = Exclude<ClientPlatform, 'unknown'> | 'browser';

/** ✓ = the direction works on this client, ✗ = it does not */
type MatrixState = 'yes' | 'no';

interface MatrixCell {
  state: MatrixState;
  /** What actually happens, shown next to the ✓/✗ */
  detail: string;
}

interface MatrixRow {
  id: MatrixRowId;
  client: string;
  /** Direction 1: markdown -> Telegram (paste into the client) */
  forward: MatrixCell;
  /** Direction 2: Telegram -> markdown (copy out of the client) */
  reverse: MatrixCell;
  note: ReactNode;
}

interface ActiveMatrixRow extends MatrixRow {
  active: boolean;
}

/**
 * Client capabilities, verified against each client's own clipboard code and
 * the design doc. This is the single source of truth for both the table and
 * the mobile card list.
 */
const MATRIX_ROWS: readonly MatrixRow[] = [
  {
    id: 'tdesktop',
    client: 'Telegram Desktop',
    forward: { state: 'yes', detail: '富文本 HTML' },
    reverse: { state: 'yes', detail: 'HTML' },
    note: '代码块的语言名会丢；折叠引用退化为普通引用。',
  },
  {
    id: 'android',
    client: 'Android',
    forward: { state: 'yes', detail: '富文本 HTML' },
    reverse: { state: 'yes', detail: 'HTML' },
    note: (
      <>
        不认行内代码（会变普通文字）；多行代码块靠 <code>&lt;br&gt;</code> 换行；剧透用私有{' '}
        <code>&lt;spoiler&gt;</code> 标签。
      </>
    ),
  },
  {
    id: 'ios',
    client: 'iOS',
    forward: { state: 'yes', detail: 'Markdown 文本（客户端粘贴时自动转）' },
    reverse: { state: 'no', detail: '只能拿到纯文本' },
    note: (
      <>
        需客户端「Markdown 粘贴」开启（默认开）；不支持 <code>||剧透||</code>。
      </>
    ),
  },
  {
    id: 'macos',
    client: 'macOS 原生',
    forward: { state: 'no', detail: '不可用' },
    reverse: { state: 'no', detail: '不可用' },
    note: '客户端既不读也不写 HTML。',
  },
  {
    id: 'web',
    client: 'Telegram 网页版',
    forward: { state: 'yes', detail: '富文本 HTML' },
    reverse: { state: 'yes', detail: 'HTML' },
    note: 'WebK 版复制时还会带精确实体 JSON，解析最准。',
  },
  {
    id: 'browser',
    client: '本页（普通浏览器）',
    forward: { state: 'yes', detail: '富文本 HTML' },
    reverse: { state: 'yes', detail: '粘贴事件 / 读取剪贴板' },
    note: 'Chrome 的「读取剪贴板」需要授权。',
  },
];

const Mark = ({ state }: { state: MatrixState }) => (
  <span className={state === 'yes' ? 'ab-mark ab-mark-yes' : 'ab-mark ab-mark-no'}>
    {state === 'yes' ? '✓' : '✗'}
  </span>
);

const CellContent = ({ cell }: { cell: MatrixCell }) => (
  <>
    <Mark state={cell.state} />
    <span>{cell.detail}</span>
  </>
);

const ClientCell = ({ row }: { row: ActiveMatrixRow }) => (
  <span className="ab-client">
    <span>{row.client}</span>
    {row.active && <span className="ab-badge">当前</span>}
  </span>
);

interface PlatformMatrixProps {
  platform: ClientPlatform;
}

/** Which direction works on which client, with the current pick highlighted */
export const PlatformMatrix = ({ platform }: PlatformMatrixProps) => {
  const rows = useMemo(
    () => MATRIX_ROWS.map((row) => ({ ...row, active: row.id === platform })),
    [platform],
  );

  return (
    <section className="section">
      <div className="ab-section-head">
        <h2 className="section-title">平台能力矩阵</h2>
        <p className="hint">
          同一段内容粘到不同客户端，能还原的程度不一样。高亮行是你当前选中的目标客户端，可在页面上方切换。
        </p>
      </div>
      <div className="card ab-matrix">
        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th scope="col">客户端</th>
                <th scope="col">方向 1：Markdown → Telegram</th>
                <th scope="col">方向 2：Telegram → Markdown</th>
                <th scope="col">说明</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-active={row.active}>
                  <th scope="row">
                    <ClientCell row={row} />
                  </th>
                  <td>
                    <CellContent cell={row.forward} />
                  </td>
                  <td>
                    <CellContent cell={row.reverse} />
                  </td>
                  <td className="ab-note">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="ab-matrix-cards">
          {rows.map((row) => (
            <li key={row.id} className="ab-matrix-card" data-active={row.active}>
              <div className="ab-matrix-card-head">
                <ClientCell row={row} />
              </div>
              <div className="ab-matrix-card-row">
                <span className="ab-matrix-card-label">方向 1 · Markdown → Telegram</span>
                <span className="ab-matrix-card-value">
                  <CellContent cell={row.forward} />
                </span>
              </div>
              <div className="ab-matrix-card-row">
                <span className="ab-matrix-card-label">方向 2 · Telegram → Markdown</span>
                <span className="ab-matrix-card-value">
                  <CellContent cell={row.reverse} />
                </span>
              </div>
              <p className="ab-matrix-card-note">{row.note}</p>
            </li>
          ))}
        </ul>
        <p className="hint ab-legend">✓ 可用，✗ 不可用。说明列只列影响使用的差异，原因见下方「已知限制」。</p>
      </div>
    </section>
  );
};
