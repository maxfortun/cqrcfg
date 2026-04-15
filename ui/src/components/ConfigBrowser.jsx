import { useState } from 'react';

export function ConfigBrowser({
  currentPath,
  paths,
  selectedPath,
  onNavigateUp,
  onNavigateTo,
  onSelectPath,
  onCreateNew,
  token,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const getDisplayName = (path) => {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  const getRelativePath = (path) => {
    if (path.startsWith(currentPath + '/')) {
      return path.slice(currentPath.length + 1);
    }
    if (path === currentPath) {
      return getDisplayName(path);
    }
    return path;
  };

  const isDirectory = (path) => {
    return paths.some((p) => p !== path && p.startsWith(path + '/'));
  };

  const getImmediateChildren = () => {
    const children = new Set();
    const prefix = currentPath === '/config' ? currentPath : currentPath;

    for (const path of paths) {
      if (path === currentPath) continue;

      const relative = path.slice(prefix.length + 1);
      const firstSegment = relative.split('/')[0];
      if (firstSegment) {
        children.add(`${prefix}/${firstSegment}`);
      }
    }

    return Array.from(children).sort();
  };

  const immediateChildren = getImmediateChildren();

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newKeyName) return;

    const newPath = `${currentPath}/${newKeyName}`;
    onCreateNew(newPath, {});
    setShowCreateModal(false);
    setNewKeyName('');
  };

  const handleItemClick = (path) => {
    const hasChildren = paths.some((p) => p !== path && p.startsWith(path + '/'));
    if (hasChildren) {
      onNavigateTo(path);
    } else {
      onSelectPath(path);
    }
  };

  const handleItemDoubleClick = (path) => {
    onSelectPath(path);
  };

  return (
    <div className="config-browser">
      <div className="browser-header">
        <div className="path-breadcrumb">
          {currentPath.split('/').filter(Boolean).map((segment, index, arr) => {
            const path = '/' + arr.slice(0, index + 1).join('/');
            return (
              <span key={path}>
                <button
                  className="breadcrumb-link"
                  onClick={() => onNavigateTo(path)}
                >
                  {segment}
                </button>
                {index < arr.length - 1 && <span className="breadcrumb-sep">/</span>}
              </span>
            );
          })}
        </div>
      </div>

      <div className="browser-toolbar">
        <button
          onClick={onNavigateUp}
          disabled={currentPath === '/config'}
          title="Go up"
        >
          ..
        </button>
        <button onClick={() => setShowCreateModal(true)} title="Create new">
          + New
        </button>
      </div>

      <ul className="path-list">
        {immediateChildren.length === 0 && (
          <li className="empty-message">No configurations found</li>
        )}
        {immediateChildren.map((path) => {
          const hasChildren = paths.some((p) => p !== path && p.startsWith(path + '/'));
          const isExact = paths.includes(path);

          return (
            <li
              key={path}
              className={`path-item ${selectedPath === path ? 'selected' : ''} ${hasChildren ? 'has-children' : ''}`}
              onClick={() => handleItemClick(path)}
              onDoubleClick={() => handleItemDoubleClick(path)}
            >
              <span className="path-icon">{hasChildren ? '/' : ''}</span>
              <span className="path-name">{getDisplayName(path)}</span>
              {isExact && <span className="path-badge">value</span>}
            </li>
          );
        })}
      </ul>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Configuration</h3>
            <form onSubmit={handleCreate}>
              <label>
                Path: {currentPath}/
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="key-name"
                  autoFocus
                  pattern="[a-zA-Z0-9_-]+"
                  title="Alphanumeric, dash, and underscore only"
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={!newKeyName}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
