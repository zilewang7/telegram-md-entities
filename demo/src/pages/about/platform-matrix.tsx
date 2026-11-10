import { useMemo } from 'react';
import { RichText } from '../../components/rich-text';
import type { ClientPlatform } from '../../core/types';
import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey } from '../../i18n/messages';

/** One row per client, plus the page itself running in a plain browser */
type MatrixRowId = Exclude<ClientPlatform, 'unknown'> | 'browser';

/** ✓ = the direction works on this client, ✗ = it does not */
type MatrixState = 'yes' | 'no';

interface MatrixRowSpec {
  readonly id: MatrixRowId;
  /** Direction 1: markdown -> Telegram (paste into the client) */
  readonly forward: MatrixState;
  /** Direction 2: Telegram -> markdown (copy out of the client) */
  readonly reverse: MatrixState;
  readonly clientKey: MessageKey;
  readonly forwardKey: MessageKey;
  readonly reverseKey: MessageKey;
  readonly noteKey: MessageKey;
}

/**
 * Client capabilities, verified against each client's own clipboard code and
 * the design doc. Copy lives in the message catalogue so both languages share
 * one source of truth.
 */
const MATRIX_ROWS: readonly MatrixRowSpec[] = [
  {
    id: 'tdesktop',
    forward: 'yes',
    reverse: 'yes',
    clientKey: 'about.row.tdesktop.client',
    forwardKey: 'about.row.tdesktop.forward',
    reverseKey: 'about.row.tdesktop.reverse',
    noteKey: 'about.row.tdesktop.note',
  },
  {
    id: 'android',
    forward: 'yes',
    reverse: 'yes',
    clientKey: 'about.row.android.client',
    forwardKey: 'about.row.android.forward',
    reverseKey: 'about.row.android.reverse',
    noteKey: 'about.row.android.note',
  },
  {
    id: 'ios',
    forward: 'yes',
    reverse: 'no',
    clientKey: 'about.row.ios.client',
    forwardKey: 'about.row.ios.forward',
    reverseKey: 'about.row.ios.reverse',
    noteKey: 'about.row.ios.note',
  },
  {
    id: 'macos',
    forward: 'no',
    reverse: 'no',
    clientKey: 'about.row.macos.client',
    forwardKey: 'about.row.macos.forward',
    reverseKey: 'about.row.macos.reverse',
    noteKey: 'about.row.macos.note',
  },
  {
    id: 'web',
    forward: 'yes',
    reverse: 'yes',
    clientKey: 'about.row.web.client',
    forwardKey: 'about.row.web.forward',
    reverseKey: 'about.row.web.reverse',
    noteKey: 'about.row.web.note',
  },
  {
    id: 'browser',
    forward: 'yes',
    reverse: 'yes',
    clientKey: 'about.row.browser.client',
    forwardKey: 'about.row.browser.forward',
    reverseKey: 'about.row.browser.reverse',
    noteKey: 'about.row.browser.note',
  },
];

const Mark = ({ state }: { state: MatrixState }) => (
  <span className={state === 'yes' ? 'ab-mark ab-mark-yes' : 'ab-mark ab-mark-no'}>
    {state === 'yes' ? '✓' : '✗'}
  </span>
);

interface CellContentProps {
  state: MatrixState;
  detail: string;
}

const CellContent = ({ state, detail }: CellContentProps) => (
  <>
    <Mark state={state} />
    <span>{detail}</span>
  </>
);

interface ClientCellProps {
  client: string;
  active: boolean;
  currentLabel: string;
}

const ClientCell = ({ client, active, currentLabel }: ClientCellProps) => (
  <span className="ab-client">
    <span>{client}</span>
    {active && <span className="ab-badge">{currentLabel}</span>}
  </span>
);

interface PlatformMatrixProps {
  platform: ClientPlatform;
}

/** Which direction works on which client, with the current pick highlighted */
export const PlatformMatrix = ({ platform }: PlatformMatrixProps) => {
  const { t } = useI18n();
  const rows = useMemo(
    () =>
      MATRIX_ROWS.map((row) => ({
        id: row.id,
        active: row.id === platform,
        client: t(row.clientKey),
        forwardState: row.forward,
        forwardDetail: t(row.forwardKey),
        reverseState: row.reverse,
        reverseDetail: t(row.reverseKey),
        note: t(row.noteKey),
      })),
    [platform, t],
  );
  const currentLabel = t('about.matrix.current');

  return (
    <section className="section">
      <div className="ab-section-head">
        <h2 className="section-title">{t('about.matrix.title')}</h2>
        <p className="hint">{t('about.matrix.intro')}</p>
      </div>
      <div className="card ab-matrix">
        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th scope="col">{t('about.matrix.col.client')}</th>
                <th scope="col">{t('about.matrix.col.forward')}</th>
                <th scope="col">{t('about.matrix.col.reverse')}</th>
                <th scope="col">{t('about.matrix.col.note')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-active={row.active}>
                  <th scope="row">
                    <ClientCell client={row.client} active={row.active} currentLabel={currentLabel} />
                  </th>
                  <td>
                    <CellContent state={row.forwardState} detail={row.forwardDetail} />
                  </td>
                  <td>
                    <CellContent state={row.reverseState} detail={row.reverseDetail} />
                  </td>
                  <td className="ab-note">
                    <RichText text={row.note} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="ab-matrix-cards">
          {rows.map((row) => (
            <li key={row.id} className="ab-matrix-card" data-active={row.active}>
              <div className="ab-matrix-card-head">
                <ClientCell client={row.client} active={row.active} currentLabel={currentLabel} />
              </div>
              <div className="ab-matrix-card-row">
                <span className="ab-matrix-card-label">{t('about.matrix.card.forward')}</span>
                <span className="ab-matrix-card-value">
                  <CellContent state={row.forwardState} detail={row.forwardDetail} />
                </span>
              </div>
              <div className="ab-matrix-card-row">
                <span className="ab-matrix-card-label">{t('about.matrix.card.reverse')}</span>
                <span className="ab-matrix-card-value">
                  <CellContent state={row.reverseState} detail={row.reverseDetail} />
                </span>
              </div>
              <p className="ab-matrix-card-note">
                <RichText text={row.note} />
              </p>
            </li>
          ))}
        </ul>
        <p className="hint ab-legend">{t('about.matrix.legend')}</p>
      </div>
    </section>
  );
};
