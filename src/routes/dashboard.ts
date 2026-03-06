import { Router } from "express";

export function dashboardRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(dashboardHtml);
  });

  return router;
}

const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LLM Gateway — Settings</title>
  <style>
    :root {
      --bg: #faf9f7;
      --surface: #ffffff;
      --surface-hover: #f5f3f0;
      --border: #e8e5e0;
      --text: #1a1815;
      --text-secondary: #6b6560;
      --text-tertiary: #9c9590;
      --accent: #d4622b;
      --accent-hover: #bf5524;
      --accent-light: #fef3ed;
      --success: #2d8a4e;
      --success-bg: #edf7f0;
      --danger: #c53030;
      --danger-bg: #fef2f2;
      --danger-hover: #a52828;
      --warning: #b7791f;
      --warning-bg: #fefce8;
      --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      --radius: 10px;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-lg: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header h1 {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header h1 .version {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary);
      background: var(--surface-hover);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Form elements */
    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    input[type="text"], input[type="password"], input[type="number"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      font-family: var(--sans);
      background: var(--surface);
      color: var(--text);
      transition: border-color 0.15s;
    }

    input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      font-family: var(--sans);
      cursor: pointer;
      transition: all 0.15s;
      background: var(--surface);
      color: var(--text);
    }

    .btn:hover { background: var(--surface-hover); }

    .btn-primary {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    .btn-danger {
      color: var(--danger);
      border-color: var(--danger);
    }

    .btn-danger:hover {
      background: var(--danger-bg);
    }

    .btn-sm {
      padding: 4px 10px;
      font-size: 12px;
    }

    /* Cards */
    .section {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .card-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
    }

    .card-row:last-child { border-bottom: none; }

    .card-row-label {
      font-size: 14px;
      font-weight: 500;
    }

    .card-row-value {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* Kill switch */
    .kill-switch-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      padding: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .kill-switch-card.disabled {
      border-color: var(--danger);
      background: var(--danger-bg);
    }

    .kill-switch-info h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .kill-switch-info p {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .kill-switch-card.disabled .kill-switch-info p {
      color: var(--danger);
    }

    .toggle {
      position: relative;
      width: 48px;
      height: 26px;
      flex-shrink: 0;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #ccc;
      border-radius: 26px;
      transition: background 0.2s;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .toggle input:checked + .toggle-slider {
      background: var(--success);
    }

    .toggle input:checked + .toggle-slider::before {
      transform: translateX(22px);
    }

    /* Provider cards */
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }

    .provider-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      box-shadow: var(--shadow-sm);
    }

    .provider-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .provider-name {
      font-size: 15px;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-dot.healthy { background: var(--success); }
    .status-dot.unhealthy { background: var(--danger); }
    .status-dot.unconfigured { background: var(--text-tertiary); }

    .provider-detail {
      font-size: 12px;
      color: var(--text-tertiary);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .provider-detail .mono {
      font-family: var(--mono);
      color: var(--text-secondary);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-success { background: var(--success-bg); color: var(--success); }
    .badge-danger { background: var(--danger-bg); color: var(--danger); }
    .badge-warning { background: var(--warning-bg); color: var(--warning); }

    /* API Keys table */
    .keys-table {
      width: 100%;
      border-collapse: collapse;
    }

    .keys-table th {
      text-align: left;
      padding: 10px 18px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--surface-hover);
      border-bottom: 1px solid var(--border);
    }

    .keys-table td {
      padding: 12px 18px;
      font-size: 14px;
      border-bottom: 1px solid var(--border);
    }

    .keys-table tr:last-child td { border-bottom: none; }

    .key-prefix {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text-secondary);
    }

    .key-name { font-weight: 500; }

    .key-date {
      font-size: 13px;
      color: var(--text-tertiary);
    }

    .keys-empty {
      padding: 32px 18px;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 14px;
    }

    /* Create key form */
    .create-key-form {
      display: flex;
      gap: 8px;
      padding: 14px 18px;
      border-top: 1px solid var(--border);
      background: var(--surface-hover);
    }

    .create-key-form input { flex: 1; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--text);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: var(--shadow-lg);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 100;
    }

    .toast.visible {
      transform: translateY(0);
      opacity: 1;
    }

    .toast.error { background: var(--danger); }

    /* New key reveal */
    .key-reveal {
      background: var(--accent-light);
      border: 1px solid var(--accent);
      border-radius: 8px;
      padding: 14px 18px;
      margin: 12px 18px;
      display: none;
    }

    .key-reveal.visible { display: block; }

    .key-reveal p {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .key-reveal code {
      font-family: var(--mono);
      font-size: 13px;
      background: var(--surface);
      padding: 8px 12px;
      border-radius: 6px;
      display: block;
      word-break: break-all;
      user-select: all;
      cursor: pointer;
    }

    /* Loading */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-top: 2px solid var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 10px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Responsive */
    @media (max-width: 600px) {
      .container { padding: 16px; }
      .provider-grid { grid-template-columns: 1fr; }
      .card-row { flex-direction: column; align-items: flex-start; gap: 4px; }
      .keys-table th:nth-child(3),
      .keys-table td:nth-child(3) { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>
      LLM Gateway
      <span class="version" id="version">v0.1.0</span>
    </h1>
    <div class="header-actions">
      <button class="btn btn-sm" onclick="refresh()">Refresh</button>
      <a href="/docs" class="btn btn-sm">API Docs</a>
    </div>
  </div>

  <div class="container">
    <!-- Kill Switch -->
    <div class="section">
      <div class="section-title">API Access</div>
      <div class="kill-switch-card" id="kill-switch-card">
        <div class="kill-switch-info">
          <h3 id="kill-switch-title">API is enabled</h3>
          <p id="kill-switch-desc">All /v1/* endpoints are accepting requests with valid API keys.</p>
        </div>
        <label class="toggle">
          <input type="checkbox" id="kill-switch" checked onchange="toggleKillSwitch(this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Gateway Info -->
    <div class="section">
      <div class="section-title">Gateway</div>
      <div class="card">
        <div class="card-row">
          <span class="card-row-label">Admin Key</span>
          <span class="card-row-value" id="admin-key-masked">&mdash;</span>
        </div>
        <div class="card-row">
          <span class="card-row-label">Port</span>
          <span class="card-row-value" id="gateway-port">&mdash;</span>
        </div>
        <div class="card-row">
          <span class="card-row-label">Log Level</span>
          <span class="card-row-value" id="gateway-log-level">&mdash;</span>
        </div>
      </div>
    </div>

    <!-- Providers -->
    <div class="section">
      <div class="section-title">Providers</div>
      <div class="provider-grid" id="providers-grid">
        <div class="loading"><div class="spinner"></div> Loading providers...</div>
      </div>
    </div>

    <!-- API Keys -->
    <div class="section">
      <div class="section-title">API Keys</div>
      <div class="card">
        <div id="key-reveal" class="key-reveal">
          <p>Save this key now &mdash; it won't be shown again.</p>
          <code id="new-key-value" title="Click to copy"></code>
        </div>
        <table class="keys-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Last Used</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="keys-body">
            <tr><td colspan="5" class="keys-empty">Loading...</td></tr>
          </tbody>
        </table>
        <div class="create-key-form">
          <input type="text" id="new-key-name" placeholder="Key name (e.g. cursor-laptop)">
          <button class="btn btn-primary btn-sm" onclick="createKey()">Create Key</button>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    // No login needed — Cloudflare SSO handles browser auth.
    // Dashboard API endpoints at /api/dashboard/* don't require Bearer tokens.

    async function apiFetch(path, options = {}) {
      const res = await fetch('/api/dashboard' + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      return res;
    }

    // Load everything on page load
    refresh();

    async function refresh() {
      await Promise.all([loadSettings(), loadKeys()]);
    }

    async function loadSettings() {
      try {
        const res = await apiFetch('/settings');
        const data = await res.json();

        // Gateway info
        document.getElementById('version').textContent = 'v' + data.gateway.version;
        document.getElementById('admin-key-masked').textContent = data.gateway.adminKey || '\\u2014';
        document.getElementById('gateway-port').textContent = data.gateway.port;
        document.getElementById('gateway-log-level').textContent = data.gateway.logLevel;

        // Kill switch state
        updateKillSwitchUI(data.gateway.apiEnabled);

        // Providers
        const grid = document.getElementById('providers-grid');
        grid.innerHTML = '';

        const providerNames = { ollama: 'Ollama', claude: 'Claude', openrouter: 'OpenRouter', minimax: 'MiniMax' };

        for (const [id, info] of Object.entries(data.providers)) {
          const name = providerNames[id] || id;
          const statusClass = !info.configured ? 'unconfigured' : info.healthy ? 'healthy' : 'unhealthy';
          const statusLabel = !info.configured ? 'Not configured' : info.healthy ? 'Healthy' : 'Unhealthy';
          const badgeClass = !info.configured ? 'badge-warning' : info.healthy ? 'badge-success' : 'badge-danger';

          let details = '';
          if (info.url) {
            details += '<div class="provider-detail">URL: <span class="mono">' + escapeHtml(info.url) + '</span></div>';
          }
          if (info.key) {
            details += '<div class="provider-detail">Key: <span class="mono">' + escapeHtml(info.key) + '</span></div>';
          }

          grid.innerHTML += '<div class="provider-card">' +
            '<div class="provider-header">' +
              '<span class="provider-name">' + escapeHtml(name) + '</span>' +
              '<span class="badge ' + badgeClass + '"><span class="status-dot ' + statusClass + '"></span> ' + statusLabel + '</span>' +
            '</div>' +
            details +
          '</div>';
        }
      } catch (e) {
        showToast('Failed to load settings', true);
      }
    }

    function updateKillSwitchUI(enabled) {
      const card = document.getElementById('kill-switch-card');
      const toggle = document.getElementById('kill-switch');
      const title = document.getElementById('kill-switch-title');
      const desc = document.getElementById('kill-switch-desc');

      toggle.checked = enabled;

      if (enabled) {
        card.classList.remove('disabled');
        title.textContent = 'API is enabled';
        desc.textContent = 'All /v1/* endpoints are accepting requests with valid API keys.';
      } else {
        card.classList.add('disabled');
        title.textContent = 'API is disabled';
        desc.textContent = 'All /v1/* endpoints are returning 503. No API requests will be processed.';
      }
    }

    async function toggleKillSwitch(enabled) {
      try {
        const res = await apiFetch('/kill-switch', {
          method: 'POST',
          body: JSON.stringify({ enabled }),
        });

        if (!res.ok) {
          showToast('Failed to toggle API access', true);
          // Revert the toggle
          document.getElementById('kill-switch').checked = !enabled;
          return;
        }

        const data = await res.json();
        updateKillSwitchUI(data.apiEnabled);
        showToast(enabled ? 'API access enabled' : 'API access disabled');
      } catch (e) {
        showToast('Failed to toggle API access', true);
        document.getElementById('kill-switch').checked = !enabled;
      }
    }

    async function loadKeys() {
      try {
        const res = await apiFetch('/keys');
        const data = await res.json();

        const tbody = document.getElementById('keys-body');

        const keys = data.data || [];
        if (keys.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="keys-empty">No API keys yet. Create one below.</td></tr>';
          return;
        }

        tbody.innerHTML = keys.map(k => {
          const revoked = k.revoked === 1;
          const lastUsed = k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never';
          const statusBadge = revoked
            ? '<span class="badge badge-danger">Revoked</span>'
            : '<span class="badge badge-success">Active</span>';
          const revokeBtn = revoked
            ? ''
            : '<button class="btn btn-danger btn-sm" onclick="revokeKey(' + k.id + ')">Revoke</button>';

          return '<tr>' +
            '<td class="key-name">' + escapeHtml(k.name) + '</td>' +
            '<td class="key-prefix">' + escapeHtml(k.key_prefix) + '...</td>' +
            '<td class="key-date">' + lastUsed + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td style="text-align:right">' + revokeBtn + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        showToast('Failed to load API keys', true);
      }
    }

    async function createKey() {
      const nameInput = document.getElementById('new-key-name');
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Enter a name for the key', true);
        return;
      }

      try {
        const res = await apiFetch('/keys', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });

        if (!res.ok) {
          const err = await res.json();
          showToast(err.error?.message || 'Failed to create key', true);
          return;
        }

        const data = await res.json();

        // Show the key
        document.getElementById('new-key-value').textContent = data.key;
        document.getElementById('key-reveal').classList.add('visible');

        nameInput.value = '';
        await loadKeys();
        showToast('API key created');
      } catch (e) {
        showToast('Failed to create key', true);
      }
    }

    async function revokeKey(id) {
      if (!confirm('Revoke this API key? This cannot be undone.')) return;

      try {
        const res = await apiFetch('/keys/' + id, { method: 'DELETE' });
        if (!res.ok) {
          showToast('Failed to revoke key', true);
          return;
        }
        await loadKeys();
        showToast('Key revoked');
      } catch (e) {
        showToast('Failed to revoke key', true);
      }
    }

    // Copy key on click
    document.addEventListener('click', (e) => {
      if (e.target.id === 'new-key-value') {
        navigator.clipboard.writeText(e.target.textContent);
        showToast('Copied to clipboard');
      }
    });

    // Enter key to create
    document.getElementById('new-key-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createKey();
    });

    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast visible' + (isError ? ' error' : '');
      setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
