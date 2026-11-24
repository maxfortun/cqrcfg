import { useState, useEffect } from 'react';
import './ConfigEditor.css';
import './Modal.css';
import { PromoteButton } from './PromoteButton';
import { Modal } from './Modal';

// Initial value for each type offered when adding a field
const NEW_FIELD_TYPES = {
  string: '',
  number: 0,
  boolean: false,
  object: {},
  array: [],
};

export function ConfigEditor({ path, data, onSave, onForceSave, onDelete, onPromote, onReload, onPreview, onClose, onDirtyChange, canWrite, remoteChange, newConfig }) {
  const [editMode, setEditMode] = useState('form'); // 'form' or 'json'
  const [jsonText, setJsonText] = useState('');
  const [formData, setFormData] = useState({});
  const [jsonError, setJsonError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  // In-progress text for number/object/array fields, so half-typed input
  // ("1.", "{") is not lost or coerced. { [key]: { text, error } }
  const [drafts, setDrafts] = useState({});
  const [addField, setAddField] = useState(null); // { name, type, error } while the Add Field modal is open
  // Read-only preview of the saved config with ___import tags resolved
  const [previewState, setPreview] = useState(null); // { path, loading, data, error }
  // Ignore a preview that belongs to a different config than the one shown
  const preview = previewState && previewState.path === path ? previewState : null;

  // `source` is the saved config the preview was resolved from, so we can tell when it is out of date
  const handlePreview = async () => {
    setPreview({ path, source: data, loading: true, data: null, error: null });
    try {
      const resolved = await onPreview(path);
      setPreview({ path, source: data, loading: false, data: resolved, error: null });
    } catch (err) {
      setPreview({ path, source: data, loading: false, data: null, error: err });
    }
  };

  const openPreview = () => {
    setEditMode('preview');
    handlePreview();
  };

  const [copied, setCopied] = useState(false);
  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(preview.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context or permission denied); nothing useful to do
    }
  };

  // The Preview tab only makes sense while a preview for this config exists;
  // after switching to another config fall back to the Form tab.
  const tab = editMode === 'preview' && !preview ? 'form' : editMode;

  const previewErrorTitle = (err) => {
    switch (err.code) {
      case 'CIRCULAR_IMPORT': return 'Circular import';
      case 'FORBIDDEN_SOURCE': return 'No access to imported config';
      case 'SOURCE_NOT_FOUND': return 'Imported config not found';
      case 'INVALID_FILTER': return 'Invalid import filter';
      case 'INVALID_IMPORT_TAG': return 'Invalid import tag';
      case 'IMPORT_DEPTH_EXCEEDED': return 'Imports nested too deeply';
      default: return err.status === 403 ? 'No access' : 'Import could not be resolved';
    }
  };

  useEffect(() => {
    if (data) {
      setJsonText(JSON.stringify(data, null, 2));
      setFormData(data);
      // A template-filled new config is unsaved, so Save must be enabled
      setHasChanges(!!newConfig);
      setJsonError(null);
      setDrafts({});
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Let the parent know about unsaved changes so it can guard navigation
  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDraftError = Object.values(drafts).some((d) => d.error);
  const hasError = !!jsonError || hasDraftError;

  const handleJsonChange = (value) => {
    setJsonText(value);
    setHasChanges(true);
    setDrafts({});
    try {
      const parsed = JSON.parse(value);
      setFormData(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  };

  const commitField = (key, value) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    setJsonText(JSON.stringify(newData, null, 2));
    setHasChanges(true);
  };

  const setDraft = (key, draft) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (draft) next[key] = draft;
      else delete next[key];
      return next;
    });
  };

  // Each field keeps the type it already has; editing never turns a string
  // into a number/boolean or vice versa.
  const handleStringChange = (key, text) => commitField(key, text);

  const handleBooleanChange = (key, text) => commitField(key, text === 'true');

  const handleNumberChange = (key, text) => {
    if (text.trim() !== '' && Number.isFinite(Number(text))) {
      setDraft(key, { text });
      commitField(key, Number(text));
    } else {
      setDraft(key, { text, error: 'Enter a number' });
    }
  };

  const handleJsonFieldChange = (key, text) => {
    try {
      const parsed = JSON.parse(text);
      setDraft(key, { text });
      commitField(key, parsed);
    } catch (e) {
      setDraft(key, { text, error: e.message });
    }
  };

  const openAddField = () => setAddField({ name: '', type: 'string', error: null });

  const submitAddField = (e) => {
    e.preventDefault();
    const name = addField.name.trim();
    if (!name) {
      setAddField({ ...addField, error: 'Enter a field name' });
    } else if (Object.hasOwn(formData, name)) {
      setAddField({ ...addField, error: `"${name}" already exists` });
    } else {
      commitField(name, structuredClone(NEW_FIELD_TYPES[addField.type]));
      setAddField(null);
    }
  };

  const handleRemoveField = (key) => {
    const newData = { ...formData };
    delete newData[key];
    setFormData(newData);
    setDraft(key, null);
    setJsonText(JSON.stringify(newData, null, 2));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (hasError) return;
    onSave(path, formData);
    setHasChanges(false);
  };

  const handleForceSave = () => {
    if (hasError) return;
    onForceSave(path, formData);
    setHasChanges(false);
  };

  const handleReset = () => {
    setJsonText(JSON.stringify(data, null, 2));
    setFormData(data);
    setHasChanges(!!newConfig);
    setJsonError(null);
    setDrafts({});
  };

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canWrite && hasChanges && !hasError) handleSave();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const renderFormField = (key, value) => {
    const valueType = typeof value;
    const isComplex = valueType === 'object' && value !== null;
    const typeLabel = value === null ? 'null' : isComplex ? (Array.isArray(value) ? 'array' : 'object') : valueType;
    const draft = drafts[key];

    return (
      <div key={key} className="form-field">
        <label>
          <span className="field-key">{key}</span>
          <span className="field-type">{typeLabel}</span>
        </label>
        {isComplex ? (
          <>
            <textarea
              value={draft?.text ?? JSON.stringify(value, null, 2)}
              onChange={(e) => handleJsonFieldChange(key, e.target.value)}
              rows={Math.min(10, JSON.stringify(value, null, 2).split('\n').length + 1)}
              className={draft?.error ? 'has-error' : ''}
              spellCheck={false}
              disabled={!canWrite}
            />
            {draft?.error && <span className="field-error">{draft.error}</span>}
          </>
        ) : valueType === 'boolean' ? (
          <select
            value={value.toString()}
            onChange={(e) => handleBooleanChange(key, e.target.value)}
            disabled={!canWrite}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : valueType === 'number' ? (
          <>
            <input
              type="number"
              step="any"
              value={draft?.text ?? value}
              onChange={(e) => handleNumberChange(key, e.target.value)}
              className={draft?.error ? 'has-error' : ''}
              disabled={!canWrite}
            />
            {draft?.error && <span className="field-error">{draft.error}</span>}
          </>
        ) : (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => handleStringChange(key, e.target.value)}
            disabled={!canWrite}
          />
        )}
        <button
          className="remove-field"
          onClick={() => handleRemoveField(key)}
          title={canWrite ? 'Remove field' : 'No write permission'}
          disabled={!canWrite}
        >
          x
        </button>
      </div>
    );
  };

  return (
    <div className="config-editor">
      <div className="editor-header">
        <h2>{path}</h2>
        {!canWrite && <span className="readonly-badge">Read Only</span>}
        {hasChanges && canWrite && <span className="unsaved-badge">● unsaved</span>}
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {newConfig && (
        <div className="remote-change-banner info-banner">
          <span>New configuration, not saved yet. Pre-filled from {newConfig.templatePath}.</span>
        </div>
      )}

      {remoteChange && remoteChange.conflict && (
        <div className="remote-change-banner conflict-banner">
          <span>Save failed: another user modified this configuration.</span>
          <div className="conflict-actions">
            <button onClick={onReload}>Reload (discard my changes)</button>
            <button onClick={handleForceSave} className="btn-force">Force save (overwrite)</button>
          </div>
        </div>
      )}

      <div className="editor-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'form'}
          className={tab === 'form' ? 'active' : ''}
          onClick={() => setEditMode('form')}
        >
          Form
        </button>
        <button
          role="tab"
          aria-selected={tab === 'json'}
          className={tab === 'json' ? 'active' : ''}
          onClick={() => setEditMode('json')}
        >
          JSON
        </button>
        <button
          role="tab"
          aria-selected={tab === 'preview'}
          className={tab === 'preview' ? 'active' : ''}
          onClick={openPreview}
          disabled={!!newConfig}
          title={newConfig ? 'Save the config first to preview it' : 'Show the saved config with imports resolved'}
        >
          Preview
        </button>
      </div>

      <div className="editor-content">
        {tab === 'preview' ? (
          <div className="import-preview">
            <div className="import-preview-header">
              <strong>Imports resolved, read-only</strong>
              <div className="import-preview-actions">
                {preview && !preview.loading && !preview.error && (
                  <button onClick={copyPreview}>{copied ? 'Copied' : 'Copy'}</button>
                )}
                <button onClick={handlePreview} disabled={preview.loading}>Refresh</button>
              </div>
            </div>
            {(hasChanges || preview.source !== data) && !preview.loading && (
              <p className="import-preview-hint">
                {preview.source !== data
                  ? 'This config changed since the preview was loaded. Refresh to update it.'
                  : 'Shows the saved config only. Unsaved edits are not included.'}
              </p>
            )}
            {preview.loading ? (
              <p className="import-preview-hint">Resolving imports...</p>
            ) : preview.error ? (
              <div className="import-preview-error" role="alert">
                <strong>{previewErrorTitle(preview.error)}</strong>
                <div>{preview.error.message}</div>
                {preview.error.source && <div>Source: <code>{preview.error.source}</code></div>}
                {preview.error.importedFrom && <div>Imported from: <code>{preview.error.importedFrom}</code></div>}
              </div>
            ) : (
              <pre className="import-preview-content">{JSON.stringify(preview.data, null, 2)}</pre>
            )}
          </div>
        ) : tab === 'form' ? (
          <div className="form-editor">
            {Object.entries(formData).map(([key, value]) =>
              renderFormField(key, value)
            )}
            {Object.keys(formData).length === 0 && (
              <p className="empty-config">
                {canWrite ? 'No fields. Click "Add Field" to add one.' : 'No fields.'}
              </p>
            )}
            <button
              className="add-field"
              onClick={openAddField}
              disabled={!canWrite}
              title={canWrite ? 'Add field' : 'No write permission'}
            >
              + Add Field
            </button>
          </div>
        ) : (
          <div className="json-editor">
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className={jsonError ? 'has-error' : ''}
              spellCheck={false}
              disabled={!canWrite}
            />
            {jsonError && <div className="json-error">{jsonError}</div>}
          </div>
        )}
      </div>

      <div className="editor-footer">
        <div className="editor-footer-left">
          <button
            className="btn-delete"
            onClick={() => onDelete(path)}
            disabled={!canWrite || !!newConfig}
            title={canWrite ? 'Delete configuration' : 'No write permission'}
          >
            Delete
          </button>
          {canWrite && !newConfig && <PromoteButton path={path} onPromote={onPromote} />}
        </div>
        <div className="editor-footer-right">
          {hasChanges && canWrite && (
            <button onClick={handleReset}>Reset</button>
          )}
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!canWrite || !hasChanges || hasError}
            title={canWrite ? (hasError ? 'Fix the errors before saving' : 'Save changes (Ctrl/Cmd+S)') : 'No write permission'}
          >
            Save
          </button>
        </div>
      </div>

      {addField && (
        <Modal title="Add field" onClose={() => setAddField(null)}>
          <form onSubmit={submitAddField}>
            <label>
              Name
              <input
                type="text"
                value={addField.name}
                onChange={(e) => setAddField({ ...addField, name: e.target.value, error: null })}
                placeholder="field-name"
                autoFocus
              />
            </label>
            <label>
              Type
              <select
                value={addField.type}
                onChange={(e) => setAddField({ ...addField, type: e.target.value })}
              >
                {Object.keys(NEW_FIELD_TYPES).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            {addField.error && <span className="field-error">{addField.error}</span>}
            <div className="modal-actions">
              <button type="button" onClick={() => setAddField(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Add</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
