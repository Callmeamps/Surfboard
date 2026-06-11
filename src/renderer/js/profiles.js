/**
 * Profiles Module — UI for managing browser profiles
 *
 * Provides a profile switcher in settings and a quick-switch dropdown.
 * Each profile isolates bookmarks, history, settings, extensions, and session.
 */
(function () {
  'use strict';

  const AVATARS = ['🌐', '👤', '💻', '🎮', '📚', '🔬', '🎨', '🔧', '🚀', '🌙'];
  const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  let _profiles = [];
  let _currentProfile = null;
  let $overlay = null;
  let $dropdown = null;
  let _deps = null;

  // ── Render profile list in settings panel ─────────────

  async function _loadProfiles() {
    try {
      _profiles = await _deps?.ipc?.profiles?.list?.() || [];
      _currentProfile = await _deps?.ipc?.profiles?.current?.() || _profiles[0];
    } catch {
      _profiles = [];
      _currentProfile = null;
    }
  }

  function _renderProfileList() {
    const $list = $overlay?.querySelector('#profiles-list');
    if (!$list) return;
    $list.innerHTML = '';

    _profiles.forEach(p => {
      const isCurrent = p.id === _currentProfile?.id;
      const el = document.createElement('div');
      el.className = 'profile-item' + (isCurrent ? ' active' : '');
      el.innerHTML = `
        <div class="profile-avatar" style="background:${p.color}">${p.avatar}</div>
        <div class="profile-info">
          <div class="profile-name">${p.name}</div>
          <div class="profile-id">${p.id === 'default' ? 'Built-in profile' : p.sessionPartition}</div>
        </div>
        ${isCurrent ? '<span class="profile-current-badge">Active</span>' : ''}
        ${p.id !== 'default' ? `<button class="profile-edit-btn" data-id="${p.id}" title="Edit">✏️</button>` : ''}
        ${p.id !== 'default' ? `<button class="profile-delete-btn" data-id="${p.id}" title="Delete">🗑️</button>` : ''}
      `;

      // Click to switch
      el.addEventListener('click', (e) => {
        if (e.target.closest('.profile-edit-btn') || e.target.closest('.profile-delete-btn')) return;
        _switchProfile(p.id);
      });

      // Edit button
      const $editBtn = el.querySelector('.profile-edit-btn');
      if ($editBtn) {
        $editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          _openEditDialog(p);
        });
      }

      // Delete button
      const $delBtn = el.querySelector('.profile-delete-btn');
      if ($delBtn) {
        $delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          _deleteProfile(p.id);
        });
      }

      $list.appendChild(el);
    });
  }

  async function _switchProfile(id) {
    if (id === _currentProfile?.id) return;
    try {
      await _deps?.ipc?.profiles?.switch?.(id);
      _currentProfile = _profiles.find(p => p.id === id) || null;
      _renderProfileList();
      _deps?.toast?.(`Switched to ${_currentProfile?.name || id}`);
      // Reload bookmarks/history for new profile
      _deps?.reload?.();
    } catch (err) {
      _deps?.toast?.('Failed to switch profile: ' + err.message);
    }
  }

  async function _deleteProfile(id) {
    if (!confirm('Delete this profile and all its data?')) return;
    try {
      await _deps?.ipc?.profiles?.delete?.(id);
      await _loadProfiles();
      _renderProfileList();
      _deps?.toast?.('Profile deleted');
    } catch (err) {
      _deps?.toast?.('Failed to delete: ' + err.message);
    }
  }

  // ── Create / Edit dialog ──────────────────────────────

  function _openCreateDialog() {
    _openEditDialog(null);
  }

  function _openEditDialog(profile) {
    const isEdit = !!profile;
    const title = isEdit ? 'Edit Profile' : 'New Profile';
    const name = profile?.name || '';
    const color = profile?.color || COLORS[Math.floor(Math.random() * COLORS.length)];
    const avatar = profile?.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)];

    const $app = document.getElementById('app');
    const $dlg = document.createElement('div');
    $dlg.className = 'profile-dialog-overlay';
    $dlg.innerHTML = `
      <div class="profile-dialog">
        <div class="profile-dialog-header">
          <h3>${title}</h3>
          <button class="profile-dialog-close">✕</button>
        </div>
        <div class="profile-dialog-body">
          <div class="profile-field">
            <label>Name</label>
            <input id="pd-name" type="text" class="settings-input no-drag" value="${name}" placeholder="Profile name">
          </div>
          <div class="profile-field">
            <label>Avatar</label>
            <div id="pd-avatars" class="profile-avatars"></div>
          </div>
          <div class="profile-field">
            <label>Color</label>
            <div id="pd-colors" class="profile-colors"></div>
          </div>
        </div>
        <div class="profile-dialog-footer">
          <button id="pd-cancel" class="btn-secondary no-drag">Cancel</button>
          <button id="pd-save" class="btn-primary no-drag">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;
    $app.appendChild($dlg);

    // Avatars
    const $avatars = $dlg.querySelector('#pd-avatars');
    AVATARS.forEach(a => {
      const el = document.createElement('span');
      el.className = 'profile-avatar-option' + (a === avatar ? ' active' : '');
      el.textContent = a;
      el.addEventListener('click', () => {
        $avatars.querySelectorAll('.profile-avatar-option').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
      });
      $avatars.appendChild(el);
    });

    // Colors
    const $colors = $dlg.querySelector('#pd-colors');
    COLORS.forEach(c => {
      const el = document.createElement('span');
      el.className = 'profile-color-option' + (c === color ? ' active' : '');
      el.style.background = c;
      el.addEventListener('click', () => {
        $colors.querySelectorAll('.profile-color-option').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
      });
      $colors.appendChild(el);
    });

    // Close
    const _close = () => $dlg.remove();
    $dlg.querySelector('.profile-dialog-close').addEventListener('click', _close);
    $dlg.querySelector('#pd-cancel').addEventListener('click', _close);
    $dlg.addEventListener('click', (e) => { if (e.target === $dlg) _close(); });

    // Save
    $dlg.querySelector('#pd-save').addEventListener('click', async () => {
      const newName = $dlg.querySelector('#pd-name').value.trim() || 'Unnamed';
      const newAvatar = $avatars.querySelector('.profile-avatar-option.active')?.textContent || avatar;
      const newColor = $colors.querySelector('.profile-color-option.active')?.style.background || color;

      try {
        if (isEdit) {
          await _deps?.ipc?.profiles?.update?.(profile.id, { name: newName, avatar: newAvatar, color: newColor });
          _deps?.toast?.('Profile updated');
        } else {
          await _deps?.ipc?.profiles?.create?.({ name: newName, avatar: newAvatar, color: newColor });
          _deps?.toast?.('Profile created');
        }
        await _loadProfiles();
        _renderProfileList();
        _close();
      } catch (err) {
        _deps?.toast?.('Failed: ' + err.message);
      }
    });

    // Focus name input
    $dlg.querySelector('#pd-name').focus();
  }

  // ── Quick-switch dropdown ─────────────────────────────

  function _buildDropdown() {
    if ($dropdown) return;
    const $app = document.getElementById('app');
    $dropdown = document.createElement('div');
    $dropdown.className = 'profile-dropdown hidden';
    $app.appendChild($dropdown);
  }

  function _renderDropdown() {
    if (!$dropdown) return;
    $dropdown.innerHTML = '';

    _profiles.forEach(p => {
      const isCurrent = p.id === _currentProfile?.id;
      const el = document.createElement('div');
      el.className = 'profile-dropdown-item' + (isCurrent ? ' active' : '');
      el.innerHTML = `<span class="profile-avatar-sm" style="background:${p.color}">${p.avatar}</span><span>${p.name}</span>${isCurrent ? ' ✓' : ''}`;
      el.addEventListener('click', () => {
        _switchProfile(p.id);
        _hideDropdown();
      });
      $dropdown.appendChild(el);
    });

    // Separator
    const sep = document.createElement('div');
    sep.className = 'profile-dropdown-sep';
    $dropdown.appendChild(sep);

    // Create new
    const $create = document.createElement('div');
    $create.className = 'profile-dropdown-item';
    $create.innerHTML = '<span class="profile-avatar-sm" style="background:#555">+</span><span>New Profile…</span>';
    $create.addEventListener('click', () => {
      _hideDropdown();
      _openCreateDialog();
    });
    $dropdown.appendChild($create);
  }

  function _showDropdown(anchor) {
    if (!$dropdown) _buildDropdown();
    _renderDropdown();
    const rect = anchor.getBoundingClientRect();
    $dropdown.style.top = (rect.bottom + 4) + 'px';
    $dropdown.style.left = rect.left + 'px';
    $dropdown.classList.remove('hidden');

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', _onDocClickDropdown);
    }, 0);
  }

  function _hideDropdown() {
    $dropdown?.classList.add('hidden');
    document.removeEventListener('click', _onDocClickDropdown);
  }

  function _onDocClickDropdown(e) {
    if ($dropdown && !$dropdown.contains(e.target) && !e.target.closest('.profile-switcher-btn')) {
      _hideDropdown();
    }
  }

  // ── Public API ────────────────────────────────────────

  function toggleDropdown(anchor) {
    if ($dropdown && !$dropdown.classList.contains('hidden')) {
      _hideDropdown();
    } else {
      _loadProfiles().then(() => _showDropdown(anchor));
    }
  }

  function toggleSettingsPanel() {
    if (!$overlay) _buildOverlay();
    if ($overlay.classList.contains('hidden')) {
      _loadProfiles().then(() => {
        _renderProfileList();
        $overlay.classList.remove('hidden');
      });
    } else {
      $overlay.classList.add('hidden');
    }
  }

  function _buildOverlay() {
    const $app = document.getElementById('app');
    $overlay = document.createElement('div');
    $overlay.className = 'settings-overlay';
    $overlay.innerHTML = `
      <div class="settings-panel">
        <div class="settings-header">
          <h2>👤 Profiles</h2>
          <button class="settings-close no-drag">✕</button>
        </div>
        <div class="settings-body">
          <div class="settings-section">
            <div class="settings-section-title">Browser Profiles</div>
            <div class="settings-row">
              <div class="settings-label">Each profile has its own bookmarks, history, settings, and extensions.</div>
            </div>
            <div id="profiles-list" class="profiles-list"></div>
            <div class="settings-row" style="margin-top:12px;display:flex;gap:8px">
              <button id="profiles-create-btn" class="btn-primary no-drag">+ New Profile</button>
              <button id="profiles-export-btn" class="btn-secondary no-drag">Export All</button>
              <button id="profiles-import-btn" class="btn-secondary no-drag">Import</button>
            </div>
          </div>
        </div>
      </div>
    `;
    $app.appendChild($overlay);

    $overlay.querySelector('.settings-close').addEventListener('click', () => $overlay.classList.add('hidden'));
    $overlay.addEventListener('click', (e) => { if (e.target === $overlay) $overlay.classList.add('hidden'); });
    $overlay.querySelector('#profiles-create-btn').addEventListener('click', _openCreateDialog);

    // Export all profiles
    $overlay.querySelector('#profiles-export-btn')?.addEventListener('click', async () => {
      try {
        const data = JSON.stringify(_profiles, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'surfboard-profiles.json';
        a.click();
        _deps?.toast?.(`Exported ${_profiles.length} profiles`);
      } catch (err) {
        _deps?.toast?.('Export failed: ' + err.message);
      }
    });

    // Import profiles
    $overlay.querySelector('#profiles-import-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const imported = JSON.parse(text);
          if (!Array.isArray(imported)) {
            _deps?.toast?.('Invalid profile file');
            return;
          }
          let count = 0;
          for (const p of imported) {
            if (p.name && p.id !== 'default') {
              await _deps?.ipc?.profiles?.create?.({
                name: p.name,
                avatar: p.avatar || '👤',
                color: p.color || '#6366f1',
              });
              count++;
            }
          }
          await _loadProfiles();
          _renderProfileList();
          _deps?.toast?.(`Imported ${count} profiles`);
        } catch (err) {
          _deps?.toast?.('Import failed: ' + err.message);
        }
      });
      input.click();
    });
  }

  function getCurrentProfile() {
    return _currentProfile;
  }

  function init(deps) {
    _deps = deps;
    // Listen for profile changes from main process
    deps?.ipc?.profiles?.onChanged?.(async (profile) => {
      _currentProfile = profile;
      await _loadProfiles();
      _deps?.toast?.(`Switched to ${profile.name}`);
      _deps?.reload?.();
    });
  }

  window.ProfilesModule = {
    init,
    toggleDropdown,
    toggleSettingsPanel,
    getCurrentProfile,
    loadProfiles: _loadProfiles,
  };
})();
