import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { ConfigBrowser } from './components/ConfigBrowser';
import { ConfigEditor } from './components/ConfigEditor';
import { TokenInput } from './components/TokenInput';
import { api } from './api';

// Environment name from runtime config (injected via /config.json or env var)
const envName = window.__CQRCFG_ENV__ || '';

function App() {
  const [token, setToken] = useState(localStorage.getItem('cqrcfg_token') || '');
  const [currentPath, setCurrentPath] = useState('/config');
  const [paths, setPaths] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [configData, setConfigData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTokenChange = (newToken) => {
    setToken(newToken);
    localStorage.setItem('cqrcfg_token', newToken);
    setError(null);
  };

  const loadPaths = useCallback(async (path) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.listPaths(path, token);
      setPaths(result.keys || []);
      setCurrentPath(path);
    } catch (err) {
      setError(err.message);
      setPaths([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadConfig = useCallback(async (path) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.getConfig(path, token);
      setConfigData(result);
      setSelectedPath(path);
    } catch (err) {
      setError(err.message);
      setConfigData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveConfig = async (path, data) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      await api.putConfig(path, data, token);
      await loadConfig(path);
      await loadPaths(currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async (path) => {
    if (!token) return;
    if (!confirm(`Delete configuration at ${path}?`)) return;

    setLoading(true);
    setError(null);

    try {
      await api.deleteConfig(path, token);
      setSelectedPath(null);
      setConfigData(null);
      await loadPaths(currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createConfig = async (path, data) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      await api.putConfig(path, data, token);
      await loadPaths(currentPath);
      await loadConfig(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadPaths(currentPath);
    }
  }, [token, loadPaths, currentPath]);

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 1) {
      const newPath = '/' + parts.slice(0, -1).join('/');
      setCurrentPath(newPath);
      loadPaths(newPath);
    }
  };

  const navigateToPath = (path) => {
    setCurrentPath(path);
    loadPaths(path);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Config Manager</h1>
        {envName && <span className="env-badge">{envName}</span>}
        <TokenInput token={token} onTokenChange={handleTokenChange} />
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading && <div className="loading-bar" />}

      <main className="app-main">
        <aside className="sidebar">
          <ConfigBrowser
            currentPath={currentPath}
            paths={paths}
            selectedPath={selectedPath}
            onNavigateUp={navigateUp}
            onNavigateTo={navigateToPath}
            onSelectPath={loadConfig}
            onCreateNew={createConfig}
            token={token}
          />
        </aside>

        <section className="content">
          {selectedPath ? (
            <ConfigEditor
              path={selectedPath}
              data={configData}
              onSave={saveConfig}
              onDelete={deleteConfig}
              onClose={() => {
                setSelectedPath(null);
                setConfigData(null);
              }}
            />
          ) : (
            <div className="placeholder">
              <p>Select a configuration path to view and edit</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
