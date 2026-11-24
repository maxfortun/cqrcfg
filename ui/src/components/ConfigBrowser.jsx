import { useState, useEffect, useRef } from 'react';
import './ConfigBrowser.css';
import './Modal.css';
import { api } from '../api';

const naturalCompare = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Wrap the matched part of a name in <mark> so it stands out in the list
function highlightMatch(text, query) {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function extractPathsFromTree(tree, basePath) {
  const paths = [];
  function walk(obj, currentPath) {
    if (obj === null || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const childPath = `${currentPath}/${key}`;
      const value = obj[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const childValues = Object.values(value);
        const allObjects = childValues.length > 0 && childValues.every(
          v => v !== null && typeof v === 'object' && !Array.isArray(v)
        );
        if (allObjects) {
          walk(value, childPath);
        } else {
          paths.push(childPath);
        }
      } else {
        paths.push(childPath);
      }
    }
  }
  walk(tree, basePath);
  return paths.length > 0 ? paths : [basePath];
}

export function ConfigBrowser({
  currentPath,
  paths,
  selectedPath,
  onNavigateUp,
  onNavigateTo,
  onSelectPath,
  onCreateNew,
  token,
  canWrite,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [goToPath, setGoToPath] = useState('');

  // Instant, client-side filter over the entries currently listed
  const [listFilter, setListFilter] = useState('');
  const listFilterRef = useRef(null);

  // "/" focuses the list filter, unless the user is already typing somewhere
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      listFilterRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Unified filter state
  const [keySearch, setKeySearch] = useState('');
  const [jsonPathQuery, setJsonPathQuery] = useState('');
  const [propFilters, setPropFilters] = useState([{ key: '', value: '' }]);
  const [filterResults, setFilterResults] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const getDisplayName = (path) => {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  const getImmediateChildren = () => {
    const children = new Set();
    const prefix = currentPath;

    for (const path of paths) {
      if (path === currentPath) continue;

      const relative = path.slice(prefix.length + 1);
      const firstSegment = relative.split('/')[0];
      if (firstSegment) {
        children.add(`${prefix}/${firstSegment}`);
      }
    }

    return Array.from(children).sort(naturalCompare);
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

  const clearFilters = () => {
    setListFilter('');
    setKeySearch('');
    setJsonPathQuery('');
    setPropFilters([{ key: '', value: '' }]);
    setFilterResults(null);
    setFilterError(null);
  };

  const handleFilter = async (e) => {
    e.preventDefault();
    if (!token) return;

    const hasKeySearch = keySearch.trim().length > 0;
    const hasJsonPath = jsonPathQuery.trim().length > 0;
    const validProps = propFilters.filter(f => f.key.trim() && f.value.trim());
    const hasProps = validProps.length > 0;

    if (!hasKeySearch && !hasJsonPath && !hasProps) return;

    setIsFiltering(true);
    setFilterError(null);

    try {
      let results = null;

      if (hasKeySearch) {
        let pattern = keySearch.trim();
        if (!pattern.startsWith('/')) {
          if (!pattern.includes('*') && !pattern.includes('?')) {
            pattern = `**/*${pattern}*`;
          }
          pattern = `${currentPath}/${pattern}`;
        }
        const result = await api.searchPaths(pattern, token);
        results = result.keys || [];
      } else if (hasJsonPath) {
        const result = await api.queryJsonPath(currentPath, jsonPathQuery.trim(), token);
        results = extractPathsFromTree(result, currentPath);
      } else if (hasProps) {
        const filterObj = {};
        for (const f of validProps) {
          filterObj[f.key.trim()] = f.value.trim();
        }
        const result = await api.queryKeyValueFilter(currentPath, filterObj, token);
        results = extractPathsFromTree(result, currentPath);
      }

      setFilterResults(results);
    } catch (err) {
      setFilterError(err.message);
      setFilterResults(null);
    } finally {
      setIsFiltering(false);
    }
  };

  const addPropRow = () => {
    setPropFilters([...propFilters, { key: '', value: '' }]);
  };

  const removePropRow = (index) => {
    const updated = propFilters.filter((_, i) => i !== index);
    setPropFilters(updated.length === 0 ? [{ key: '', value: '' }] : updated);
  };

  const updatePropRow = (index, field, value) => {
    const updated = [...propFilters];
    updated[index] = { ...updated[index], [field]: value };
    setPropFilters(updated);
  };

  const handleItemClick = (path) => {
    const hasChildren = paths.some((p) => p !== path && p.startsWith(path + '/'));
    if (hasChildren) {
      setListFilter('');
      onNavigateTo(path);
    } else {
      onSelectPath(path);
    }
  };

  const handleItemDoubleClick = (path) => {
    onSelectPath(path);
  };

  // Mutual exclusivity: JSONPath and property filters disable each other
  const hasActivePropInput = propFilters.some(f => f.key.trim() || f.value.trim());
  const hasActiveJsonPathInput = jsonPathQuery.trim().length > 0;
  const isJsonPathDisabled = hasActivePropInput;
  const isPropsDisabled = hasActiveJsonPathInput;

  const hasAnyFilterInput = keySearch.trim().length > 0 || hasActiveJsonPathInput || hasActivePropInput;

  // Determine which paths to display
  const isShowingFilterResults = filterResults !== null;
  const baseDisplayPaths = isShowingFilterResults ? filterResults : immediateChildren;
  const listQuery = listFilter.trim();
  const displayPaths = listQuery
    ? baseDisplayPaths.filter((p) =>
        (isShowingFilterResults ? p : getDisplayName(p)).toLowerCase().includes(listQuery.toLowerCase())
      )
    : baseDisplayPaths;

  const activateItem = (path) => {
    if (isShowingFilterResults) onSelectPath(path);
    else handleItemClick(path);
  };

  const handleListFilterKeyDown = (e) => {
    if (e.key === 'Escape') {
      setListFilter('');
      e.currentTarget.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      document.querySelector('.path-list .path-item')?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayPaths.length === 1) activateItem(displayPaths[0]);
    }
  };

  const handleItemKeyDown = (e, path) => {
    const item = e.currentTarget;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      item.nextElementSibling?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (item.previousElementSibling) item.previousElementSibling.focus();
      else listFilterRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activateItem(path);
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelectPath(path);
    } else if (e.key === 'Backspace' && !isShowingFilterResults && currentPath !== '/config') {
      e.preventDefault();
      onNavigateUp();
      clearFilters();
    }
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
                  onClick={() => { onNavigateTo(path); clearFilters(); }}
                >
                  {segment}
                </button>
                {index < arr.length - 1 && <span className="breadcrumb-sep">/</span>}
              </span>
            );
          })}
          {window.__CQRCFG_GIT_BRANCH__ && (
            <span className="branch-badge">{window.__CQRCFG_GIT_BRANCH__}</span>
          )}
        </div>
      </div>

      <form className="search-form" onSubmit={(e) => {
        e.preventDefault();
        if (!goToPath.trim()) return;
        let target = goToPath.trim();
        if (!target.startsWith('/config')) {
          target = `/config${target.startsWith('/') ? '' : '/'}${target}`;
        }
        onNavigateTo(target);
        setGoToPath('');
        clearFilters();
      }}>
        <input
          type="text"
          className="search-input"
          placeholder="Go to path... /config/app/db"
          value={goToPath}
          onChange={(e) => setGoToPath(e.target.value)}
        />
        <button type="submit" disabled={!goToPath.trim()}>
          Go
        </button>
      </form>

      <div className="list-filter">
        <input
          ref={listFilterRef}
          type="search"
          className="search-input"
          placeholder="Filter this list...  ( / )"
          aria-label="Filter this list"
          value={listFilter}
          onChange={(e) => setListFilter(e.target.value)}
          onKeyDown={handleListFilterKeyDown}
        />
      </div>

      <details className="advanced-filters" open={isShowingFilterResults || hasAnyFilterInput || undefined}>
      <summary>Advanced search</summary>
      <form className="filter-section" onSubmit={handleFilter}>
        <div className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="Keys... (*, **, ?)"
            value={keySearch}
            onChange={(e) => setKeySearch(e.target.value)}
          />
        </div>

        <div className={`filter-group ${isJsonPathDisabled ? 'filter-disabled' : ''}`}>
          <input
            type="text"
            className="search-input"
            placeholder="JSONPath... $..field"
            value={jsonPathQuery}
            onChange={(e) => setJsonPathQuery(e.target.value)}
            disabled={isJsonPathDisabled}
          />
        </div>

        <div className={`filter-group filter-group-props ${isPropsDisabled ? 'filter-disabled' : ''}`}>
          {propFilters.map((filter, index) => (
            <div className="prop-filter-row" key={index}>
              <input
                type="text"
                className="search-input prop-input"
                placeholder="property"
                value={filter.key}
                onChange={(e) => updatePropRow(index, 'key', e.target.value)}
                disabled={isPropsDisabled}
              />
              <span className="prop-equals">=</span>
              <input
                type="text"
                className="search-input prop-input"
                placeholder="value"
                value={filter.value}
                onChange={(e) => updatePropRow(index, 'value', e.target.value)}
                disabled={isPropsDisabled}
              />
              {propFilters.length > 1 && (
                <button type="button" className="prop-remove" onClick={() => removePropRow(index)} disabled={isPropsDisabled}>
                  x
                </button>
              )}
            </div>
          ))}
          <button type="button" className="prop-add" onClick={addPropRow} disabled={isPropsDisabled}>
            + property
          </button>
        </div>

        <div className="filter-actions">
          <button type="submit" disabled={isFiltering || !hasAnyFilterInput}>
            {isFiltering ? '...' : 'Filter'}
          </button>
          {(isShowingFilterResults || hasAnyFilterInput) && (
            <button type="button" onClick={clearFilters} className="clear-search">
              Clear
            </button>
          )}
        </div>
      </form>
      </details>

      {filterError && <div className="filter-error">{filterError}</div>}

      <div className="browser-toolbar">
        <button
          onClick={() => { onNavigateUp(); clearFilters(); }}
          disabled={currentPath === '/config'}
          title="Go up"
        >
          ..
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          title={canWrite ? 'Create new' : 'No write permission'}
          disabled={!canWrite}
        >
          + New
        </button>
        <span className="search-count">
          {listQuery
            ? `${displayPaths.length} of ${baseDisplayPaths.length}`
            : isShowingFilterResults
              ? `${displayPaths.length} results`
              : `${displayPaths.length} items`}
        </span>
      </div>

      <ul className="path-list" role="listbox" aria-label="Configurations">
        {displayPaths.length === 0 && (
          <li className="empty-message">
            {listQuery || isShowingFilterResults ? 'No matching configurations found' : 'No configurations found'}
          </li>
        )}
        {displayPaths.map((path) => {
          const hasChildren = paths.some((p) => p !== path && p.startsWith(path + '/'));
          const isExact = paths.includes(path);
          const label = isShowingFilterResults ? path : getDisplayName(path);

          return (
            <li
              key={path}
              role="option"
              aria-selected={selectedPath === path}
              tabIndex={0}
              title={path}
              className={`path-item ${selectedPath === path ? 'selected' : ''} ${hasChildren ? 'has-children' : ''}`}
              onClick={() => activateItem(path)}
              onDoubleClick={() => handleItemDoubleClick(path)}
              onKeyDown={(e) => handleItemKeyDown(e, path)}
            >
              <span className="path-icon">{hasChildren && !isShowingFilterResults ? '/' : ''}</span>
              <span className="path-name">{highlightMatch(label, listQuery)}</span>
              {/* Only worth a badge when the path is both a folder and a value */}
              {isExact && hasChildren && !isShowingFilterResults && <span className="path-badge">value</span>}
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
