// Assets screen (SAD 4.8): every asset grouped by class, with add, edit and
// delete for all four classes (B23; PWM-F-010 to PWM-F-014) and, for real
// estate, "Update value" (PWM-F-022) and "History" (PWM-F-023).
// The API only returns the user's own, non-deleted assets. A change made here
// calls notifyAssetsChanged(), which reloads this list and the dashboard totals.
import { useEffect, useRef, useState } from 'react';
import { deleteAsset, listAssets } from '../api/assets.js';
import { notifyAssetsChanged } from '../api/assetEvents.js';
import { isUnauthorized } from '../api/http.js';
import { useApiResource } from '../lib/useApiResource.js';
import { formatINR } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import { ASSET_TYPE_ORDER, assetTypeLabel } from '../lib/assetTypes.js';
import { GOLD_FORMS } from '../lib/assetForm.js';
import AssetForm from '../components/AssetForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SessionExpired from '../components/SessionExpired.jsx';

export default function AssetsPage() {
  const assets = useApiResource(listAssets, undefined);
  // null, { kind: 'add' } or { kind: 'edit', asset }
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const addButtonRef = useRef(null);

  function openEditor(next) {
    setMessage(null);
    setEditor(next);
  }

  function closeEditor(text) {
    setEditor(null);
    if (text) setMessage(text);
    // Back to a sensible place for keyboard users once the form is gone.
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }

  if (sessionEnded || assets.status === 'unauthorized') {
    return (
      <main className="page">
        <PageHeader />
        <SessionExpired />
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader>
        {!editor && (
          <button ref={addButtonRef} type="button" className="button" onClick={() => openEditor({ kind: 'add' })}>
            Add asset
          </button>
        )}
      </PageHeader>

      {message && (
        <p className="status-message" role="status" data-testid="asset-status">
          {message}
        </p>
      )}

      {editor && (
        <EditorPanel
          key={editor.kind === 'edit' ? editor.asset.id : 'new'}
          asset={editor.kind === 'edit' ? editor.asset : null}
          onSaved={closeEditor}
          onCancel={() => closeEditor(null)}
          onSessionEnded={() => setSessionEnded(true)}
        />
      )}

      <AssetList resource={assets} onEdit={(asset) => openEditor({ kind: 'edit', asset })} onDelete={setDeleting} />

      {deleting && (
        <DeleteAsset
          asset={deleting}
          onDone={(text) => {
            setDeleting(null);
            if (editor?.kind === 'edit' && editor.asset.id === deleting.id) setEditor(null);
            setMessage(text);
          }}
          onCancel={() => setDeleting(null)}
          onSessionEnded={() => setSessionEnded(true)}
        />
      )}
    </main>
  );
}

function EditorPanel({ asset, ...handlers }) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  return (
    <section className="card editor-card" aria-labelledby="asset-editor-heading">
      <h2 ref={headingRef} id="asset-editor-heading" className="section-title" tabIndex={-1}>
        {asset ? `Edit ${asset.name}` : 'Add an asset'}
      </h2>
      <AssetForm asset={asset} {...handlers} />
    </section>
  );
}

function PageHeader({ children }) {
  return (
    <header className="page-header page-header-row">
      <div>
        <h1 tabIndex={-1}>Assets</h1>
        <p className="muted">Add, edit or remove your real estate, gold, stocks and cash. Changes show up in your totals straight away.</p>
      </div>
      {children}
    </header>
  );
}

function AssetList({ resource, onEdit, onDelete }) {
  if (resource.status === 'loading') {
    return (
      <div className="card skeleton" role="status">
        <span className="sr-only">Loading your assets</span>
      </div>
    );
  }
  if (resource.status === 'error') {
    return (
      <div className="card error-card" role="alert">
        <p>We couldn't load your assets. {resource.error.message}</p>
        <button type="button" className="button" onClick={resource.retry}>
          Try again
        </button>
      </div>
    );
  }

  const items = resource.data.items;
  if (items.length === 0) {
    return (
      <div className="card notice-card" data-testid="assets-empty">
        <p className="notice-title">No assets yet</p>
        <p className="muted">Use "Add asset" to record a property, gold, a stock holding or a bank balance.</p>
      </div>
    );
  }

  // The four SRS classes in display order, then anything stored before B22 with another type.
  const known = new Set(ASSET_TYPE_ORDER);
  const groups = [
    ...ASSET_TYPE_ORDER.map((type) => [type, items.filter((a) => a.assetType === type)]),
    ['OTHER', items.filter((a) => !known.has(a.assetType))],
  ].filter(([, list]) => list.length > 0);

  return groups.map(([type, list]) => (
    <section key={type} className="asset-section" aria-labelledby={`assets-${type}`}>
      <h2 id={`assets-${type}`} className="section-title">
        {type === 'OTHER' ? 'Other (needs a type)' : assetTypeLabel(type)}
        <span className="muted section-count"> ({list.length})</span>
      </h2>
      <ul className="property-list">
        {list.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  ));
}

const formLabel = (form) => GOLD_FORMS.find((f) => f.value === form)?.label ?? form;

// One line under the name with the details of the asset's class.
function details(asset) {
  switch (asset.assetType) {
    case 'REAL_ESTATE':
      return asset.location;
    case 'GOLD':
      return [formLabel(asset.form), asset.purityKarat && `${asset.purityKarat}K`, asset.weightGrams && `${asset.weightGrams} g`]
        .filter(Boolean)
        .join(' · ');
    case 'STOCK':
      return [asset.quantity && `${asset.quantity} shares`, asset.exchange].filter(Boolean).join(' · ');
    case 'CASH':
      return asset.accountLabel && asset.accountLabel !== asset.name ? asset.accountLabel : null;
    default:
      return 'Edit this asset to choose its type.';
  }
}

// The second figure on the card, next to the current value.
function secondFact(asset) {
  if (asset.assetType === 'GOLD' && asset.purchasePrice) return ['Purchase price', formatINR(asset.purchasePrice)];
  if (asset.assetType === 'STOCK' && asset.averageBuyPrice) return ['Avg. buy price', formatINR(asset.averageBuyPrice)];
  return [asset.assetType === 'REAL_ESTATE' ? 'Last valued' : 'Last updated', asset.valuedAt ? formatDate(asset.valuedAt) : 'Not yet'];
}

function AssetCard({ asset, onEdit, onDelete }) {
  const base = `#/assets/${encodeURIComponent(asset.id)}`;
  const line = details(asset);
  const [factLabel, factValue] = secondFact(asset);
  const isProperty = asset.assetType === 'REAL_ESTATE';
  return (
    <li
      className="card property"
      data-testid={isProperty ? 'property' : 'asset'}
      data-asset-id={asset.id}
      data-asset-type={asset.assetType}
    >
      <div>
        <h3 className="property-name">{asset.name}</h3>
        {line && <p className="muted">{line}</p>}
      </div>
      <dl className="facts">
        <div>
          <dt>{asset.assetType === 'CASH' ? 'Balance' : 'Current value'}</dt>
          <dd className="property-value">{formatINR(asset.currentValue)}</dd>
        </div>
        <div>
          <dt>{factLabel}</dt>
          <dd>{factValue}</dd>
        </div>
      </dl>
      <div className="actions">
        {isProperty && (
          <>
            <a className="button" href={`${base}/valuation`}>
              Update value<span className="sr-only"> of {asset.name}</span>
            </a>
            <a className="button button-secondary" href={`${base}/history`}>
              History<span className="sr-only"> of {asset.name}</span>
            </a>
          </>
        )}
        <button type="button" className="button button-secondary" onClick={() => onEdit(asset)}>
          Edit<span className="sr-only"> {asset.name}</span>
        </button>
        <button type="button" className="button button-secondary button-danger-text" onClick={() => onDelete(asset)}>
          Delete<span className="sr-only"> {asset.name}</span>
        </button>
      </div>
    </li>
  );
}

// DELETE /api/assets/:id is a soft delete (SAD 4.4): the asset leaves the list,
// the totals and the exports, and its history is kept.
function DeleteAsset({ asset, onDone, onCancel, onSessionEnded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteAsset(asset.id);
      notifyAssetsChanged();
      onDone(`${asset.name} was deleted.`);
    } catch (err) {
      setBusy(false);
      if (isUnauthorized(err)) onSessionEnded();
      else if (err.status === 404) {
        notifyAssetsChanged();
        onDone(`${asset.name} had already been deleted.`);
      } else setError(`We couldn't delete it. ${err.message}`);
    }
  }

  return (
    <ConfirmDialog
      title={`Delete ${asset.name}?`}
      confirmLabel="Delete"
      busyLabel="Deleting…"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p>
        It will no longer count toward your net worth or appear in reports. Its valuation history is kept. Worth{' '}
        {formatINR(asset.currentValue)}.
      </p>
    </ConfirmDialog>
  );
}
