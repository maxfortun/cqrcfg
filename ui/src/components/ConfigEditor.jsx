import { useState, useEffect } from 'react';
import { PromoteButton } from './PromoteButton';

export function ConfigEditor({ path, data, onSave, onForceSave, onDelete, onPromote, onReload, onPreview, onClose, canWrite, remoteChange, newConfig }) {
  const [editMode, setEditMode] = useState('form'); // 'form' or 'json'
  const [jsonText, setJsonText] = useState('');
  const [formData, setFormData] = useState({});
  const [jsonError, setJsonError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  // Read-only preview of the saved config with ___import tags resolved
  const [previewState, setPreview] = useState(null); // { path, loading, data, error }
  // Ignore a preview that belongs to a different config than the one shown
  const preview = previewState && previewState.path === path ? previewState : null;

  const handlePreview = async () => {
    setPreview({ path, loading: true, data: null, error: null });
    try {
      const resolved = await onPreview(path);
      setPreview({ path, loading: false, data: resolved, error: null });
    } catch (err) {
      setPreview({ path, loading: false, data: null, error: err });
    }
  };

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
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJsonChange = (value) => {
    setJsonText(value);
    setHasChanges(true);
    try {
      const parsed = JSON.parse(value);
      setFormData(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  };

  const handleFormFieldChange = (key, value) => {
    const newData = { ...formData };

    // Try to parse as JSON for complex values
    try {
      newData[key] = JSON.parse(value);
    } catch {
      newData[key] = value;
    }

    setFormData(newData);
    setJsonText(JSON.stringify(newData, null, 2));
    setHasChanges(true);
  };

  const handleAddField = () => {
    const key = prompt('Enter field name:');
    if (key && !formData.hasOwnProperty(key)) {
      handleFormFieldChange(key, '');
    }
  };

  const handleRemoveField = (key) => {
    const newData = { ...formData };
    delete newData[key];
    setFormData(newData);
    setJsonText(JSON.stringify(newData, null, 2));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (jsonError) {
      alert('Please fix JSON errors before saving');
      return;
    }
    onSave(path, formData);
    setHasChanges(false);
  };

  const handleForceSave = () => {
    if (jsonError) {
      alert('Please fix JSON errors before saving');
      return;
    }
    onForceSave(path, formData);
    setHasChanges(false);
  };

  const handleReset = () => {
    setJsonText(JSON.stringify(data, null, 2));
    setFormData(data);
    setHasChanges(!!newConfig);
    setJsonError(null);
  };

  const renderFormField = (key, value) => {
    const valueType = typeof value;
    const isComplex = valueType === 'object' && value !== null;

    return (
      <div key={key} className="form-field">
        <label>
          <span className="field-key">{key}</span>
          <span className="field-type">{isComplex ? (Array.isArray(value) ? 'array' : 'object') : valueType}</span>
        </label>
        {isComplex ? (
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => handleFormFieldChange(key, e.target.value)}
            rows={Math.min(10, JSON.stringify(value, null, 2).split('\n').length + 1)}
            disabled={!canWrite}
          />
        ) : valueType === 'boolean' ? (
          <select
            value={value.toString()}
            onChange={(e) => handleFormFieldChange(key, e.target.value)}
            disabled={!canWrite}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : valueType === 'number' ? (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFormFieldChange(key, e.target.value)}
            disabled={!canWrite}
          />
        ) : (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => handleFormFieldChange(key, e.target.value)}
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
        <div className="editor-actions">
          <button
            onClick={handlePreview}
            disabled={!!newConfig || (preview && preview.loading)}
            title={newConfig ? 'Save the config first to preview it' : 'Show the saved config with imports resolved'}
          >
            Preview
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {newConfig && (
        <div className="remote-change-banner">
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

      {preview && !preview.loading && (
        <div className="import-preview">
          <div className="import-preview-header">
            <strong>Preview (imports resolved, read-only)</strong>
            <button onClick={() => setPreview(null)}>Close preview</button>
          </div>
          {hasChanges && (
            <p className="import-preview-hint">
              Shows the saved config only. Unsaved edits are not included.
            </p>
          )}
          {preview.error ? (
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
      )}
      {preview && preview.loading && <p className="import-preview-hint">Resolving imports...</p>}

      <div className="editor-tabs">
        <button
          className={editMode === 'form' ? 'active' : ''}
          onClick={() => setEditMode('form')}
        >
          Form
        </button>
        <button
          className={editMode === 'json' ? 'active' : ''}
          onClick={() => setEditMode('json')}
        >
          JSON
        </button>
      </div>

      <div className="editor-content">
        {editMode === 'form' ? (
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
              onClick={handleAddField}
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
            disabled={!canWrite || !hasChanges || jsonError}
            title={canWrite ? 'Save changes' : 'No write permission'}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
