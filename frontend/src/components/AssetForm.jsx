// Add or edit an asset (B23; PWM-F-010 to PWM-F-015, SAD 4.8).
// The fields change with the asset type. Input is checked in the browser with
// the API's rules (lib/assetForm.js); the server's field errors appear on the
// same inputs. After a save, notifyAssetsChanged() refreshes the asset list and
// the dashboard totals (PWM-F-014).
import { useRef, useState } from 'react';
import { createAsset, updateAsset } from '../api/assets.js';
import { notifyAssetsChanged } from '../api/assetEvents.js';
import { fieldErrors, isUnauthorized } from '../api/http.js';
import { fieldsFor, initialValues, TYPE_FIELDS, validateAssetForm } from '../lib/assetForm.js';
import { ASSET_TYPE_ORDER, assetTypeLabel } from '../lib/assetTypes.js';

const TYPE_FIELD_ID = 'asset-assetType';

export default function AssetForm({ asset = null, onSaved, onCancel, onSessionEnded }) {
  const editing = Boolean(asset);
  // An asset stored before B22 may have a type outside the four; it must get one.
  const [type, setType] = useState(asset && TYPE_FIELDS[asset.assetType] ? asset.assetType : asset ? '' : 'REAL_ESTATE');
  const [values, setValues] = useState(() => initialValues(asset));
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const formRef = useRef(null);

  const fields = fieldsFor(type);

  function check(nextType, nextValues) {
    if (!nextType) return { errors: { assetType: 'Choose an asset type.' }, body: null };
    return validateAssetForm(nextType, nextValues, { editing });
  }

  function focusField(name) {
    formRef.current?.querySelector(`#asset-${name}`)?.focus();
  }

  function change(name, value) {
    const next = { ...values, [name]: value };
    setValues(next);
    if (attempted) setErrors(check(type, next).errors);
  }

  function changeType(nextType) {
    setType(nextType);
    setFormError(null);
    if (attempted) setErrors(check(nextType, values).errors);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setAttempted(true);
    setFormError(null);
    const result = check(type, values);
    setErrors(result.errors);
    const firstInvalid = ['assetType', ...fields.map((f) => f.name)].find((name) => result.errors[name]);
    if (firstInvalid) {
      // Invalid input never leaves the browser.
      focusField(firstInvalid);
      return;
    }

    setSaving(true);
    try {
      if (editing) await updateAsset(asset.id, result.body);
      else await createAsset(result.body);
      notifyAssetsChanged();
      onSaved(editing ? `${asset.name} was updated.` : `${assetTypeLabel(type)} asset added.`);
    } catch (err) {
      setSaving(false);
      if (isUnauthorized(err)) {
        onSessionEnded?.();
      } else if (err.status === 400 && err.fields.length > 0) {
        const server = fieldErrors(err);
        const shown = Object.fromEntries(Object.entries(server).filter(([name]) => name === 'assetType' || fields.some((f) => f.name === name)));
        setErrors(shown);
        const hidden = Object.keys(server).filter((name) => !(name in shown));
        if (hidden.length > 0 || Object.keys(shown).length === 0) setFormError(err.message);
        const first = ['assetType', ...fields.map((f) => f.name)].find((name) => shown[name]);
        if (first) focusField(first);
      } else if (err.status === 404) {
        setFormError('This asset no longer exists. It may have been deleted.');
      } else {
        setFormError(`We couldn't save the asset. ${err.message}`);
      }
    }
  }

  return (
    <form ref={formRef} className="form" onSubmit={handleSubmit} noValidate data-testid="asset-form">
      <div className="field">
        <label htmlFor={TYPE_FIELD_ID}>Asset type</label>
        <select
          id={TYPE_FIELD_ID}
          name="assetType"
          className="input"
          value={type}
          aria-invalid={errors.assetType ? true : undefined}
          aria-describedby={errors.assetType ? `${TYPE_FIELD_ID}-error` : undefined}
          onChange={(e) => changeType(e.target.value)}
        >
          {!type && <option value="">Choose a type</option>}
          {ASSET_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {assetTypeLabel(t)}
            </option>
          ))}
        </select>
        {errors.assetType && (
          <p id={`${TYPE_FIELD_ID}-error`} className="field-error">
            {errors.assetType}
          </p>
        )}
      </div>

      {fields.map((field) => (
        <Field key={`${type}-${field.name}`} field={field} value={values[field.name]} error={errors[field.name]} onChange={change} />
      ))}

      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add asset'}
        </button>
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ field, value, error, onChange }) {
  const id = `asset-${field.name}`;
  const describedBy = [field.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: field.name,
    className: 'input',
    value,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onChange: (e) => onChange(field.name, e.target.value),
  };

  let control;
  if (field.kind === 'select') {
    control = (
      <select {...common}>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === 'date') {
    control = <input {...common} type="date" />;
  } else {
    const numeric = ['money', 'decimal', 'karat'].includes(field.kind);
    control = (
      <input
        {...common}
        type="text"
        inputMode={numeric ? (field.kind === 'karat' ? 'numeric' : 'decimal') : undefined}
        autoComplete="off"
        autoCapitalize={field.kind === 'ticker' ? 'characters' : undefined}
        maxLength={field.max}
        placeholder={field.placeholder ?? (field.kind === 'money' ? 'e.g. 85,00,000' : undefined)}
      />
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      {control}
      {field.hint && (
        <p id={`${id}-hint`} className="field-hint">
          {field.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
