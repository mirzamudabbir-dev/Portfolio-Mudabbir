/* =============================================
   Admin Panel — Full SPA Logic
   ============================================= */

(function () {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  let state = {
    data: null,
    selectedProjects: new Set(),
    searchQuery: '',
    filterStatus: 'all',
    currentView: 'dashboard'
  };

  // ============================================
  // API HELPERS
  // ============================================
  async function api(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      throw err;
    }
  }

  async function apiUpload(url, formData) {
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  // ============================================
  // TOAST SYSTEM
  // ============================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon">${icons[type] || icons.info}</div><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================
  // CONFIRM DIALOG
  // ============================================
  function showConfirm(title, message, okLabel = 'Delete') {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-overlay');
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      document.getElementById('confirm-ok').textContent = okLabel;
      overlay.style.display = 'flex';

      const handleOk = () => { cleanup(); resolve(true); };
      const handleCancel = () => { cleanup(); resolve(false); };

      function cleanup() {
        overlay.style.display = 'none';
        document.getElementById('confirm-ok').removeEventListener('click', handleOk);
        document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
      }

      document.getElementById('confirm-ok').addEventListener('click', handleOk);
      document.getElementById('confirm-cancel').addEventListener('click', handleCancel);
    });
  }

  // ============================================
  // MODAL SYSTEM
  // ============================================
  function openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal-overlay').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  }

  // ============================================
  // AUTH
  // ============================================
  async function checkAuth() {
    try {
      const data = await api('/api/auth/check');

      if (data.needsSetup) {
        showScreen('setup');
        return;
      }

      if (data.authenticated) {
        showScreen('app');
        await loadData();
      } else {
        showScreen('login');
      }
    } catch {
      showScreen('login');
    }
  }

  function showScreen(screen) {
    document.getElementById('setup-screen').style.display = screen === 'setup' ? 'flex' : 'none';
    document.getElementById('login-screen').style.display = screen === 'login' ? 'flex' : 'none';
    document.getElementById('admin-app').style.display = screen === 'app' ? 'flex' : 'none';
  }

  function initAuth() {
    // Setup form
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('setup-password').value;
      const confirm = document.getElementById('setup-confirm').value;
      const errEl = document.getElementById('setup-error');

      if (pw !== confirm) {
        errEl.textContent = 'Passwords do not match';
        errEl.classList.add('visible');
        return;
      }

      try {
        await api('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password: pw }) });
        showToast('Admin account created!', 'success');
        showScreen('app');
        await loadData();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('visible');
      }
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');

      try {
        await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
        showToast('Welcome back!', 'success');
        showScreen('app');
        await loadData();
      } catch (err) {
        errEl.textContent = err.message || 'Invalid password';
        errEl.classList.add('visible');
      }
    });

    // Logout
    document.getElementById('nav-logout').addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/api/auth/logout', { method: 'POST' });
      showScreen('login');
      showToast('Logged out', 'info');
    });
  }

  // ============================================
  // DATA LOADING
  // ============================================
  async function loadData() {
    try {
      state.data = await api('/api/admin/data');
      renderCurrentView();
    } catch (err) {
      showToast('Failed to load data: ' + err.message, 'error');
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================
  function initNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        switchView(view);
      });
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
      } else {
        sidebar.classList.toggle('collapsed');
      }
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Global search
    document.getElementById('global-search').addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      if (state.currentView === 'projects') renderProjects();
    });
  }

  function switchView(view) {
    state.currentView = view;
    // Update nav
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`[data-view="${view}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) {
      activeView.classList.remove('active');
      // Force reflow for animation
      void activeView.offsetWidth;
      activeView.classList.add('active');
    }

    // Update title
    const titles = { dashboard: 'Dashboard', projects: 'Projects', sections: 'Sections', media: 'Media Library', settings: 'Site Settings' };
    document.getElementById('page-title').textContent = titles[view] || 'Dashboard';

    // Show/hide search
    document.getElementById('global-search-box').style.display = view === 'projects' ? 'flex' : 'none';

    renderCurrentView();

    // Close mobile sidebar
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('mobile-open');
    }
  }

  function renderCurrentView() {
    if (!state.data) return;
    switch (state.currentView) {
      case 'dashboard': renderDashboard(); break;
      case 'projects': renderProjects(); break;
      case 'sections': renderSections(); break;
      case 'media': renderMedia(); break;
      case 'settings': renderSettings(); break;
    }
  }

  // ============================================
  // DASHBOARD VIEW
  // ============================================
  function renderDashboard() {
    const d = state.data;
    const published = d.projects.filter(p => p.status === 'published').length;
    const drafts = d.projects.filter(p => p.status === 'draft').length;
    const sections = d.sections.filter(s => s.visible).length;

    document.getElementById('view-dashboard').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-label">Total Projects</div>
          <div class="stat-card-value">${d.projects.length}</div>
          <div class="stat-card-sub">${published} published, ${drafts} drafts</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Active Sections</div>
          <div class="stat-card-value">${sections}</div>
          <div class="stat-card-sub">${d.sections.length} total sections</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Featured</div>
          <div class="stat-card-value">${d.projects.filter(p => p.featured).length}</div>
          <div class="stat-card-sub">highlighted projects</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Tags Used</div>
          <div class="stat-card-value">${new Set(d.projects.flatMap(p => p.tags || [])).size}</div>
          <div class="stat-card-sub">unique categories</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        <div class="settings-section">
          <div class="settings-section-title">Quick Actions</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button class="btn btn-primary" onclick="window._admin.switchView('projects'); window._admin.openProjectModal();">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              New Project
            </button>
            <button class="btn btn-secondary" onclick="window._admin.switchView('media');">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              Upload Media
            </button>
            <a href="/" target="_blank" class="btn btn-secondary" style="justify-content: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
              View Portfolio
            </a>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Recent Projects</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${d.projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5).map(p => `
              <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                <div style="width: 40px; height: 28px; border-radius: 6px; overflow: hidden; background: var(--bg-elevated); flex-shrink: 0;">
                  ${p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;">` : ''}
                </div>
                <div style="flex:1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escHtml(p.title)}</div>
                </div>
                <span class="status-badge status-${p.status}">${p.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // PROJECTS VIEW
  // ============================================
  function renderProjects() {
    const d = state.data;
    let projects = [...d.projects].sort((a, b) => a.order - b.order);

    // Filter
    if (state.filterStatus !== 'all') {
      projects = projects.filter(p => p.status === state.filterStatus);
    }

    // Search
    if (state.searchQuery) {
      projects = projects.filter(p =>
        p.title.toLowerCase().includes(state.searchQuery) ||
        p.category.toLowerCase().includes(state.searchQuery) ||
        (p.tags || []).some(t => t.toLowerCase().includes(state.searchQuery))
      );
    }

    const hasSelected = state.selectedProjects.size > 0;

    document.getElementById('view-projects').innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="filter-chip ${state.filterStatus === 'all' ? 'active' : ''}" data-filter="all">All (${d.projects.length})</span>
          <span class="filter-chip ${state.filterStatus === 'published' ? 'active' : ''}" data-filter="published">Published</span>
          <span class="filter-chip ${state.filterStatus === 'draft' ? 'active' : ''}" data-filter="draft">Drafts</span>
          <span class="filter-chip ${state.filterStatus === 'hidden' ? 'active' : ''}" data-filter="hidden">Hidden</span>
        </div>
        <div class="toolbar-right">
          ${hasSelected ? `
            <button class="btn btn-danger btn-sm" id="bulk-delete-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              Delete (${state.selectedProjects.size})
            </button>
          ` : ''}
          <button class="btn btn-primary btn-sm" id="add-project-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New Project
          </button>
        </div>
      </div>
      ${projects.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="64" height="64"><path d="M2 17 12 22 22 17"/><path d="M2 12 12 17 22 12"/><path d="M12 2 2 7 12 12 22 7 12 2z"/></svg>
          </div>
          <h3>No projects found</h3>
          <p>${state.searchQuery ? 'Try a different search term.' : 'Create your first project to get started.'}</p>
        </div>
      ` : `
        <div class="projects-grid" id="projects-grid">
          ${projects.map(p => renderProjectCard(p)).join('')}
        </div>
      `}
    `;

    // Event Bindings
    bindProjectEvents();
  }

  function renderProjectCard(p) {
    const isSelected = state.selectedProjects.has(p.id);
    return `
      <div class="project-card" data-id="${p.id}" draggable="true">
        <div class="project-card-check ${isSelected ? 'checked' : ''}" data-id="${p.id}"></div>
        ${p.image
          ? `<img class="project-card-img" src="${escHtml(p.image)}" alt="${escHtml(p.title)}" loading="lazy" />`
          : `<div class="project-card-img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`
        }
        <div class="project-card-body">
          <div class="project-card-header">
            <div>
              <div class="project-card-title">${escHtml(p.title)}</div>
              <div class="project-card-cat">${escHtml(p.category)}</div>
            </div>
            <span class="status-badge status-${p.status}">${p.status}</span>
          </div>
          ${(p.tags && p.tags.length) ? `
            <div class="project-card-tags">
              ${p.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
          <div class="project-card-actions">
            <div class="drag-handle" title="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
            </div>
            <div style="flex:1"></div>
            <button class="icon-btn edit-project-btn" data-id="${p.id}" title="Edit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
            <button class="icon-btn duplicate-project-btn" data-id="${p.id}" title="Duplicate">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
            <button class="icon-btn delete-project-btn" data-id="${p.id}" title="Delete" style="color:var(--danger)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bindProjectEvents() {
    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.filterStatus = chip.dataset.filter;
        renderProjects();
      });
    });

    // Add project
    const addBtn = document.getElementById('add-project-btn');
    if (addBtn) addBtn.addEventListener('click', () => openProjectModal());

    // Bulk delete
    const bulkBtn = document.getElementById('bulk-delete-btn');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          'Delete Selected',
          `Are you sure you want to delete ${state.selectedProjects.size} project(s)? This cannot be undone.`
        );
        if (confirmed) {
          try {
            await api('/api/admin/projects/bulk-delete', {
              method: 'POST',
              body: JSON.stringify({ ids: [...state.selectedProjects] })
            });
            state.selectedProjects.clear();
            showToast('Projects deleted', 'success');
            await loadData();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    }

    // Checkboxes
    document.querySelectorAll('.project-card-check').forEach(check => {
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = check.dataset.id;
        if (state.selectedProjects.has(id)) {
          state.selectedProjects.delete(id);
        } else {
          state.selectedProjects.add(id);
        }
        renderProjects();
      });
    });

    // Edit
    document.querySelectorAll('.edit-project-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const project = state.data.projects.find(p => p.id === btn.dataset.id);
        if (project) openProjectModal(project);
      });
    });

    // Duplicate
    document.querySelectorAll('.duplicate-project-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/api/admin/projects/${btn.dataset.id}/duplicate`, { method: 'POST' });
          showToast('Project duplicated', 'success');
          await loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Delete
    document.querySelectorAll('.delete-project-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirm('Delete Project', 'Are you sure you want to delete this project? This cannot be undone.');
        if (confirmed) {
          try {
            await api(`/api/admin/projects/${btn.dataset.id}`, { method: 'DELETE' });
            showToast('Project deleted', 'success');
            await loadData();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    // Drag and drop
    initProjectDragDrop();
  }

  // --- Project Modal ---
  function openProjectModal(project = null) {
    const isEdit = !!project;
    const p = project || { title: '', category: '', description: '', tags: [], image: '', link: '#', linkTarget: '_self', status: 'draft', featured: false, metrics: {} };

    const body = `
      <div class="input-group">
        <label for="proj-title">Title</label>
        <input type="text" id="proj-title" value="${escHtml(p.title)}" placeholder="Project title" />
      </div>
      <div class="input-group">
        <label for="proj-category">Category</label>
        <input type="text" id="proj-category" value="${escHtml(p.category)}" placeholder="e.g. Web Application" />
      </div>
      <div class="input-group">
        <label for="proj-description">Description</label>
        <textarea id="proj-description" placeholder="Brief description...">${escHtml(p.description)}</textarea>
      </div>
      <div class="input-group">
        <label>Tags</label>
        <div class="tags-input-container" id="tags-container">
          ${(p.tags || []).map(t => `<span class="tags-input-tag">${escHtml(t)}<span class="tags-input-remove" data-tag="${escHtml(t)}">&times;</span></span>`).join('')}
          <input type="text" class="tags-input-field" id="tags-input" placeholder="Type and press Enter" />
        </div>
      </div>
      <div class="input-group">
        <label>Project Image</label>
        <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
          <div style="flex: 1;">
            <input type="text" id="proj-image" value="${escHtml(p.image)}" placeholder="Image URL or upload" />
          </div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer; flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Upload
            <input type="file" accept="image/*" id="proj-image-upload" style="display:none" />
          </label>
        </div>
        <div id="proj-image-preview" style="margin-top:0.75rem;border-radius:8px;overflow:hidden;max-height:160px;">
          ${p.image ? `<img src="${escHtml(p.image)}" style="width:100%;height:160px;object-fit:cover;" />` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div class="input-group">
          <label for="proj-link">Link URL</label>
          <input type="text" id="proj-link" value="${escHtml(p.link)}" placeholder="https://..." />
        </div>
        <div class="input-group">
          <label for="proj-link-target">Link Target</label>
          <select id="proj-link-target">
            <option value="_self" ${p.linkTarget === '_self' ? 'selected' : ''}>Same Tab</option>
            <option value="_blank" ${p.linkTarget === '_blank' ? 'selected' : ''}>New Tab</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div class="input-group">
          <label for="proj-status">Status</label>
          <select id="proj-status">
            <option value="published" ${p.status === 'published' ? 'selected' : ''}>Published</option>
            <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="hidden" ${p.status === 'hidden' ? 'selected' : ''}>Hidden</option>
          </select>
        </div>
        <div class="input-group" style="display:flex;align-items:flex-end;padding-bottom:0.15rem;">
          <label style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;">
            <div class="toggle ${p.featured ? 'active' : ''}" id="proj-featured"></div>
            <span style="font-size:0.85rem;">Featured</span>
          </label>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="window._admin.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-project-btn">${isEdit ? 'Save Changes' : 'Create Project'}</button>
    `;

    openModal(isEdit ? 'Edit Project' : 'New Project', body, footer);

    // Init tags
    initTagsInput(p.tags || []);

    // Image upload handler
    document.getElementById('proj-image-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('image', file);
      try {
        const result = await apiUpload('/api/admin/upload', formData);
        document.getElementById('proj-image').value = result.file.url;
        document.getElementById('proj-image-preview').innerHTML = `<img src="${result.file.url}" style="width:100%;height:160px;object-fit:cover;" />`;
        showToast('Image uploaded', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Featured toggle
    document.getElementById('proj-featured').addEventListener('click', function() {
      this.classList.toggle('active');
    });

    // Save
    document.getElementById('save-project-btn').addEventListener('click', async () => {
      const projectData = {
        title: document.getElementById('proj-title').value,
        category: document.getElementById('proj-category').value,
        description: document.getElementById('proj-description').value,
        tags: currentTags,
        image: document.getElementById('proj-image').value,
        link: document.getElementById('proj-link').value || '#',
        linkTarget: document.getElementById('proj-link-target').value,
        status: document.getElementById('proj-status').value,
        featured: document.getElementById('proj-featured').classList.contains('active')
      };

      if (!projectData.title.trim()) {
        showToast('Title is required', 'error');
        return;
      }

      try {
        if (isEdit) {
          await api(`/api/admin/projects/${p.id}`, { method: 'PUT', body: JSON.stringify(projectData) });
          showToast('Project updated', 'success');
        } else {
          await api('/api/admin/projects', { method: 'POST', body: JSON.stringify(projectData) });
          showToast('Project created', 'success');
        }
        closeModal();
        await loadData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Tags input
  let currentTags = [];

  function initTagsInput(tags) {
    currentTags = [...tags];
    const container = document.getElementById('tags-container');
    const input = document.getElementById('tags-input');

    // Focus input when clicking container
    container.addEventListener('click', () => input.focus());

    // Remove tag
    container.querySelectorAll('.tags-input-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = btn.dataset.tag;
        currentTags = currentTags.filter(t => t !== tag);
        rerenderTags();
      });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/,/g, '');
        if (val && !currentTags.includes(val)) {
          currentTags.push(val);
          rerenderTags();
        }
        input.value = '';
      }
      if (e.key === 'Backspace' && !input.value && currentTags.length) {
        currentTags.pop();
        rerenderTags();
      }
    });
  }

  function rerenderTags() {
    const container = document.getElementById('tags-container');
    const input = document.getElementById('tags-input');
    // Remove old tags
    container.querySelectorAll('.tags-input-tag').forEach(t => t.remove());
    // Add new
    currentTags.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tags-input-tag';
      span.innerHTML = `${escHtml(t)}<span class="tags-input-remove" data-tag="${escHtml(t)}">&times;</span>`;
      container.insertBefore(span, input);
      span.querySelector('.tags-input-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        currentTags = currentTags.filter(x => x !== t);
        rerenderTags();
      });
    });
  }

  // Project drag-and-drop
  function initProjectDragDrop() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    let draggedId = null;

    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        grid.querySelectorAll('.project-card').forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const targetId = card.dataset.id;
        if (draggedId === targetId) return;

        // Reorder
        const projects = [...state.data.projects].sort((a, b) => a.order - b.order);
        const draggedIdx = projects.findIndex(p => p.id === draggedId);
        const targetIdx = projects.findIndex(p => p.id === targetId);

        const [removed] = projects.splice(draggedIdx, 1);
        projects.splice(targetIdx, 0, removed);

        const orderedIds = projects.map(p => p.id);

        try {
          await api('/api/admin/projects/reorder', {
            method: 'POST',
            body: JSON.stringify({ orderedIds })
          });
          showToast('Order updated', 'success');
          await loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // ============================================
  // SECTIONS VIEW
  // ============================================
  const CORE_TYPES = ['hero', 'about', 'work', 'contact'];

  function renderSections() {
    const sections = [...state.data.sections].sort((a, b) => a.order - b.order);

    document.getElementById('view-sections').innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <p style="color:var(--text-secondary);font-size:0.9rem;">Manage your portfolio sections. Drag to reorder, toggle visibility.</p>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary btn-sm" id="add-section-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New Section
          </button>
        </div>
      </div>
      <div class="section-list" id="sections-list">
        ${sections.map(s => {
          const isCore = CORE_TYPES.includes(s.type);
          return `
          <div class="section-item" data-id="${s.id}" draggable="true">
            <div class="drag-handle" title="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
            </div>
            <div class="section-item-info">
              <div class="section-item-name">${escHtml(s.navLabel)}</div>
              <div class="section-item-type">${s.type} section${isCore ? ' · core' : ''}</div>
            </div>
            <div class="section-item-actions">
              <div class="toggle ${s.visible ? 'active' : ''}" data-id="${s.id}" data-action="toggle-visibility" title="${s.visible ? 'Visible' : 'Hidden'}"></div>
              <button class="icon-btn edit-section-btn" data-id="${s.id}" title="Edit">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              ${!isCore ? `
                <button class="icon-btn delete-section-btn" data-id="${s.id}" title="Delete" style="color:var(--danger)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              ` : ''}
            </div>
          </div>
        `;}).join('')}
      </div>
    `;

    // Add section
    document.getElementById('add-section-btn').addEventListener('click', () => openNewSectionModal());

    // Toggle visibility
    document.querySelectorAll('[data-action="toggle-visibility"]').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const section = state.data.sections.find(s => s.id === toggle.dataset.id);
        if (!section) return;

        try {
          await api(`/api/admin/sections/${section.id}`, {
            method: 'PUT',
            body: JSON.stringify({ visible: !section.visible })
          });
          showToast(`${section.navLabel} ${section.visible ? 'hidden' : 'shown'}`, 'success');
          await loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Edit section
    document.querySelectorAll('.edit-section-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = state.data.sections.find(s => s.id === btn.dataset.id);
        if (section) openSectionModal(section);
      });
    });

    // Delete section
    document.querySelectorAll('.delete-section-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const section = state.data.sections.find(s => s.id === btn.dataset.id);
        if (!section) return;
        const confirmed = await showConfirm(
          'Delete Section',
          `Are you sure you want to delete the "${section.navLabel}" section? This cannot be undone.`
        );
        if (confirmed) {
          try {
            await api(`/api/admin/sections/${section.id}`, { method: 'DELETE' });
            showToast('Section deleted', 'success');
            await loadData();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    // Section drag-and-drop
    initSectionDragDrop();
  }

  // --- New Section Modal ---
  function openNewSectionModal() {
    const sectionTypes = [
      {
        type: 'content',
        label: 'Content Page',
        desc: 'A rich section with a heading, body text, and optional image.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>'
      },
      {
        type: 'gallery',
        label: 'Gallery',
        desc: 'A visual grid section to showcase images and media.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
      },
      {
        type: 'text',
        label: 'Text Block',
        desc: 'A minimal centered text section — great for quotes, statements, or CTAs.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/></svg>'
      },
      {
        type: 'cta',
        label: 'Call to Action',
        desc: 'A bold section with a heading, text, and a prominent button link.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>'
      }
    ];

    const body = `
      <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1.5rem;">Choose a section type to add to your portfolio.</p>
      <div class="section-type-grid">
        ${sectionTypes.map(st => `
          <div class="section-type-card" data-type="${st.type}">
            <div class="section-type-icon">${st.icon}</div>
            <div class="section-type-label">${st.label}</div>
            <div class="section-type-desc">${st.desc}</div>
          </div>
        `).join('')}
      </div>
      <div id="new-section-form" style="display:none;margin-top:1.5rem;">
        <hr style="border:none;border-top:1px solid var(--border);margin-bottom:1.5rem;">
        <div class="input-group">
          <label for="new-sec-nav-label">Navigation Label</label>
          <input type="text" id="new-sec-nav-label" placeholder="e.g. SERVICES" />
        </div>
        <div id="new-section-type-fields"></div>
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="window._admin.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="create-section-btn" disabled>Create Section</button>
    `;

    openModal('New Section', body, footer);

    let selectedType = null;

    // Type selection
    document.querySelectorAll('.section-type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.section-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedType = card.dataset.type;

        const form = document.getElementById('new-section-form');
        form.style.display = 'block';
        document.getElementById('create-section-btn').disabled = false;

        // Render type-specific fields
        const fieldsContainer = document.getElementById('new-section-type-fields');
        fieldsContainer.innerHTML = getFieldsForSectionType(selectedType);
      });
    });

    // Create
    document.getElementById('create-section-btn').addEventListener('click', async () => {
      if (!selectedType) return;

      const navLabel = document.getElementById('new-sec-nav-label').value.trim();
      if (!navLabel) {
        showToast('Navigation label is required', 'error');
        return;
      }

      const content = gatherSectionContent(selectedType);
      if (content === null) return; // validation failed inside

      try {
        await api('/api/admin/sections', {
          method: 'POST',
          body: JSON.stringify({ type: selectedType, navLabel: navLabel.toUpperCase(), content })
        });
        showToast('Section created', 'success');
        closeModal();
        await loadData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function getFieldsForSectionType(type) {
    switch (type) {
      case 'content':
        return `
          <div class="input-group">
            <label for="new-sec-heading">Heading</label>
            <input type="text" id="new-sec-heading" placeholder="Section heading" />
          </div>
          <div class="input-group">
            <label for="new-sec-subheading">Subheading (outline style)</label>
            <input type="text" id="new-sec-subheading" placeholder="Optional subheading" />
          </div>
          <div class="input-group">
            <label for="new-sec-body">Body Text</label>
            <textarea id="new-sec-body" placeholder="Write your content here..." rows="5"></textarea>
          </div>
          <div class="input-group">
            <label>Section Image</label>
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <div style="flex:1"><input type="text" id="new-sec-image" placeholder="Image URL or upload" /></div>
              <label class="btn btn-secondary btn-sm" style="cursor:pointer;flex-shrink:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                Upload
                <input type="file" accept="image/*" id="new-sec-image-upload" style="display:none" />
              </label>
            </div>
          </div>
        `;
      case 'gallery':
        return `
          <div class="input-group">
            <label for="new-sec-heading">Gallery Title</label>
            <input type="text" id="new-sec-heading" placeholder="e.g. Selected Work" />
          </div>
          <div class="input-group">
            <label for="new-sec-gallery-urls">Image URLs (one per line)</label>
            <textarea id="new-sec-gallery-urls" placeholder="/uploads/photo1.jpg&#10;/uploads/photo2.jpg&#10;/images/example.png" rows="6" style="font-family:var(--font-mono);font-size:0.8rem;"></textarea>
          </div>
        `;
      case 'text':
        return `
          <div class="input-group">
            <label for="new-sec-heading">Heading</label>
            <input type="text" id="new-sec-heading" placeholder="A bold statement" />
          </div>
          <div class="input-group">
            <label for="new-sec-body">Body Text</label>
            <textarea id="new-sec-body" placeholder="Supporting text..." rows="4"></textarea>
          </div>
        `;
      case 'cta':
        return `
          <div class="input-group">
            <label for="new-sec-heading">Heading</label>
            <input type="text" id="new-sec-heading" placeholder="Let's work together" />
          </div>
          <div class="input-group">
            <label for="new-sec-body">Description</label>
            <textarea id="new-sec-body" placeholder="Brief description..." rows="3"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div class="input-group">
              <label for="new-sec-btn-text">Button Text</label>
              <input type="text" id="new-sec-btn-text" placeholder="Get in Touch" />
            </div>
            <div class="input-group">
              <label for="new-sec-btn-url">Button URL</label>
              <input type="text" id="new-sec-btn-url" placeholder="https://..." />
            </div>
          </div>
        `;
      default:
        return '';
    }
  }

  function gatherSectionContent(type) {
    const headingEl = document.getElementById('new-sec-heading');
    const bodyEl = document.getElementById('new-sec-body');

    switch (type) {
      case 'content':
        return {
          heading: headingEl?.value || '',
          subheading: document.getElementById('new-sec-subheading')?.value || '',
          body: bodyEl?.value || '',
          image: document.getElementById('new-sec-image')?.value || ''
        };
      case 'gallery': {
        const urlsText = document.getElementById('new-sec-gallery-urls')?.value || '';
        const images = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
        return {
          heading: headingEl?.value || '',
          images
        };
      }
      case 'text':
        return {
          heading: headingEl?.value || '',
          body: bodyEl?.value || ''
        };
      case 'cta':
        return {
          heading: headingEl?.value || '',
          body: bodyEl?.value || '',
          buttonText: document.getElementById('new-sec-btn-text')?.value || '',
          buttonUrl: document.getElementById('new-sec-btn-url')?.value || '#'
        };
      default:
        return {};
    }
  }

  // --- Edit Section Modal (updated) ---
  function openSectionModal(section) {
    let contentFields = '';
    const c = section.content || {};

    if (section.type === 'about') {
      contentFields = `
        <div class="input-group">
          <label>Heading</label>
          <input type="text" id="sec-heading" value="${escHtml(c.heading || '')}" />
        </div>
        <div class="input-group">
          <label>Heading Outline</label>
          <input type="text" id="sec-heading-outline" value="${escHtml(c.headingOutline || '')}" />
        </div>
        <div class="input-group">
          <label>Body Text</label>
          <textarea id="sec-body">${escHtml(c.body || '')}</textarea>
        </div>
        <div class="input-group">
          <label>Stats (JSON)</label>
          <textarea id="sec-stats" style="font-family:var(--font-mono);font-size:0.8rem;">${JSON.stringify(c.stats || [], null, 2)}</textarea>
        </div>
        <div class="input-group">
          <label>Skill Cards (JSON)</label>
          <textarea id="sec-skills" style="font-family:var(--font-mono);font-size:0.8rem;">${JSON.stringify(c.skillCards || [], null, 2)}</textarea>
        </div>
      `;
    } else if (section.type === 'contact') {
      contentFields = `
        <div class="input-group">
          <label>Heading</label>
          <input type="text" id="sec-contact-heading" value="${escHtml(c.heading || '')}" />
        </div>
        <div class="input-group">
          <label>Social Links (JSON)</label>
          <textarea id="sec-social-links" style="font-family:var(--font-mono);font-size:0.8rem;min-height:200px;">${JSON.stringify(c.socialLinks || [], null, 2)}</textarea>
        </div>
      `;
    } else if (section.type === 'content') {
      contentFields = `
        <div class="input-group">
          <label>Heading</label>
          <input type="text" id="sec-custom-heading" value="${escHtml(c.heading || '')}" />
        </div>
        <div class="input-group">
          <label>Subheading (outline style)</label>
          <input type="text" id="sec-custom-subheading" value="${escHtml(c.subheading || '')}" />
        </div>
        <div class="input-group">
          <label>Body Text</label>
          <textarea id="sec-custom-body">${escHtml(c.body || '')}</textarea>
        </div>
        <div class="input-group">
          <label>Image URL</label>
          <input type="text" id="sec-custom-image" value="${escHtml(c.image || '')}" />
        </div>
      `;
    } else if (section.type === 'gallery') {
      const imageUrls = (c.images || []).join('\n');
      contentFields = `
        <div class="input-group">
          <label>Gallery Title</label>
          <input type="text" id="sec-gallery-heading" value="${escHtml(c.heading || '')}" />
        </div>
        <div class="input-group">
          <label>Image URLs (one per line)</label>
          <textarea id="sec-gallery-urls" style="font-family:var(--font-mono);font-size:0.8rem;" rows="8">${escHtml(imageUrls)}</textarea>
        </div>
      `;
    } else if (section.type === 'text') {
      contentFields = `
        <div class="input-group">
          <label>Heading</label>
          <input type="text" id="sec-text-heading" value="${escHtml(c.heading || '')}" />
        </div>
        <div class="input-group">
          <label>Body Text</label>
          <textarea id="sec-text-body">${escHtml(c.body || '')}</textarea>
        </div>
      `;
    } else if (section.type === 'cta') {
      contentFields = `
        <div class="input-group">
          <label>Heading</label>
          <input type="text" id="sec-cta-heading" value="${escHtml(c.heading || '')}" />
        </div>
        <div class="input-group">
          <label>Description</label>
          <textarea id="sec-cta-body">${escHtml(c.body || '')}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div class="input-group">
            <label>Button Text</label>
            <input type="text" id="sec-cta-btn-text" value="${escHtml(c.buttonText || '')}" />
          </div>
          <div class="input-group">
            <label>Button URL</label>
            <input type="text" id="sec-cta-btn-url" value="${escHtml(c.buttonUrl || '#')}" />
          </div>
        </div>
      `;
    }

    const body = `
      <div class="input-group">
        <label>Navigation Label</label>
        <input type="text" id="sec-nav-label" value="${escHtml(section.navLabel)}" />
      </div>
      ${contentFields}
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="window._admin.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-section-btn">Save Changes</button>
    `;

    openModal('Edit Section: ' + section.navLabel, body, footer);

    // Image upload for content type
    const uploadInput = document.getElementById('new-sec-image-upload');
    if (uploadInput) {
      uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
          const result = await apiUpload('/api/admin/upload', formData);
          const imgInput = document.getElementById('sec-custom-image') || document.getElementById('new-sec-image');
          if (imgInput) imgInput.value = result.file.url;
          showToast('Image uploaded', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    document.getElementById('save-section-btn').addEventListener('click', async () => {
      const updateData = {
        navLabel: document.getElementById('sec-nav-label').value
      };

      if (section.type === 'about') {
        try {
          updateData.content = {
            heading: document.getElementById('sec-heading').value,
            headingOutline: document.getElementById('sec-heading-outline').value,
            body: document.getElementById('sec-body').value,
            stats: JSON.parse(document.getElementById('sec-stats').value),
            skillCards: JSON.parse(document.getElementById('sec-skills').value)
          };
        } catch {
          showToast('Invalid JSON in stats or skill cards', 'error');
          return;
        }
      } else if (section.type === 'contact') {
        try {
          updateData.content = {
            heading: document.getElementById('sec-contact-heading').value,
            socialLinks: JSON.parse(document.getElementById('sec-social-links').value)
          };
        } catch {
          showToast('Invalid JSON in social links', 'error');
          return;
        }
      } else if (section.type === 'content') {
        updateData.content = {
          heading: document.getElementById('sec-custom-heading').value,
          subheading: document.getElementById('sec-custom-subheading').value,
          body: document.getElementById('sec-custom-body').value,
          image: document.getElementById('sec-custom-image').value
        };
      } else if (section.type === 'gallery') {
        const urlsText = document.getElementById('sec-gallery-urls').value;
        updateData.content = {
          heading: document.getElementById('sec-gallery-heading').value,
          images: urlsText.split('\n').map(u => u.trim()).filter(Boolean)
        };
      } else if (section.type === 'text') {
        updateData.content = {
          heading: document.getElementById('sec-text-heading').value,
          body: document.getElementById('sec-text-body').value
        };
      } else if (section.type === 'cta') {
        updateData.content = {
          heading: document.getElementById('sec-cta-heading').value,
          body: document.getElementById('sec-cta-body').value,
          buttonText: document.getElementById('sec-cta-btn-text').value,
          buttonUrl: document.getElementById('sec-cta-btn-url').value || '#'
        };
      }

      try {
        await api(`/api/admin/sections/${section.id}`, { method: 'PUT', body: JSON.stringify(updateData) });
        showToast('Section updated', 'success');
        closeModal();
        await loadData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function initSectionDragDrop() {
    const list = document.getElementById('sections-list');
    if (!list) return;

    let draggedId = null;

    list.querySelectorAll('.section-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedId = item.dataset.id;
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        list.querySelectorAll('.section-item').forEach(i => i.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const targetId = item.dataset.id;
        if (draggedId === targetId) return;

        const sections = [...state.data.sections].sort((a, b) => a.order - b.order);
        const draggedIdx = sections.findIndex(s => s.id === draggedId);
        const targetIdx = sections.findIndex(s => s.id === targetId);

        const [removed] = sections.splice(draggedIdx, 1);
        sections.splice(targetIdx, 0, removed);

        try {
          await api('/api/admin/sections/reorder', {
            method: 'POST',
            body: JSON.stringify({ orderedIds: sections.map(s => s.id) })
          });
          showToast('Section order updated', 'success');
          await loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // ============================================
  // MEDIA VIEW
  // ============================================
  async function renderMedia() {
    let files = [];
    try {
      files = await api('/api/admin/uploads');
    } catch { /* empty */ }

    // Also include images from the images directory
    const existingImages = [
      { filename: 'dabg.png', url: '/images/dabg.png', size: 0, uploadedAt: '', isOriginal: true },
      { filename: 'tmbg.png', url: '/images/tmbg.png', size: 0, uploadedAt: '', isOriginal: true }
    ];

    document.getElementById('view-media').innerHTML = `
      <div class="media-upload-zone" id="upload-zone">
        <input type="file" accept="image/*" id="media-file-input" multiple />
        <div class="upload-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
        </div>
        <div class="upload-text">Drop images here or click to upload</div>
        <div class="upload-hint">JPG, PNG, GIF, WebP, SVG — Max 10MB</div>
      </div>

      ${files.length || existingImages.length ? `
        <h3 style="margin-bottom:1rem;font-size:1rem;">Uploaded Files</h3>
        <div class="media-grid">
          ${files.map(f => `
            <div class="media-item" data-filename="${escHtml(f.filename)}">
              <img src="${escHtml(f.url)}" alt="${escHtml(f.filename)}" loading="lazy" />
              <div class="media-item-overlay">
                <span class="media-item-name">${escHtml(f.filename)}</span>
                <button class="media-item-delete" data-filename="${escHtml(f.filename)}" title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        ${existingImages.length ? `
          <h3 style="margin: 2rem 0 1rem; font-size:1rem;">Original Images</h3>
          <div class="media-grid">
            ${existingImages.map(f => `
              <div class="media-item">
                <img src="${escHtml(f.url)}" alt="${escHtml(f.filename)}" loading="lazy" />
                <div class="media-item-overlay">
                  <span class="media-item-name">${escHtml(f.filename)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="64" height="64"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </div>
          <h3>No media uploaded yet</h3>
          <p>Upload images to use in your projects.</p>
        </div>
      `}
    `;

    // Upload handler
    const fileInput = document.getElementById('media-file-input');
    const zone = document.getElementById('upload-zone');

    fileInput.addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        const formData = new FormData();
        formData.append('image', file);
        try {
          await apiUpload('/api/admin/upload', formData);
          showToast(`${file.name} uploaded`, 'success');
        } catch (err) {
          showToast(`Failed: ${file.name} — ${err.message}`, 'error');
        }
      }
      renderMedia();
    });

    // Drag-and-drop on zone
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-active'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-active');
      for (const file of e.dataTransfer.files) {
        if (!file.type.startsWith('image/')) continue;
        const formData = new FormData();
        formData.append('image', file);
        try {
          await apiUpload('/api/admin/upload', formData);
          showToast(`${file.name} uploaded`, 'success');
        } catch (err) {
          showToast(`Failed: ${file.name}`, 'error');
        }
      }
      renderMedia();
    });

    // Delete
    document.querySelectorAll('.media-item-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirm('Delete Image', 'Are you sure? This cannot be undone.');
        if (confirmed) {
          try {
            await api(`/api/admin/upload/${btn.dataset.filename}`, { method: 'DELETE' });
            showToast('Image deleted', 'success');
            renderMedia();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    // Click to copy URL
    document.querySelectorAll('.media-item').forEach(item => {
      item.addEventListener('click', () => {
        const img = item.querySelector('img');
        if (img) {
          navigator.clipboard.writeText(img.src).then(() => {
            showToast('Image URL copied', 'info');
          });
        }
      });
    });
  }

  // ============================================
  // SETTINGS VIEW
  // ============================================
  function renderSettings() {
    const s = state.data.site;

    document.getElementById('view-settings').innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Site Identity</div>
        <div class="settings-grid">
          <div class="input-group">
            <label for="set-title">Site Title</label>
            <input type="text" id="set-title" value="${escHtml(s.title)}" />
          </div>
          <div class="input-group">
            <label for="set-logo">Logo Text</label>
            <input type="text" id="set-logo" value="${escHtml(s.logo)}" />
          </div>
          <div class="input-group">
            <label for="set-tagline">Tagline</label>
            <input type="text" id="set-tagline" value="${escHtml(s.tagline)}" />
          </div>
          <div class="input-group">
            <label for="set-footer">Footer Text</label>
            <input type="text" id="set-footer" value="${escHtml(s.footerText)}" />
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Hero Section</div>
        <div class="settings-grid">
          <div class="input-group">
            <label for="set-hero-line1">Name Line 1</label>
            <input type="text" id="set-hero-line1" value="${escHtml(s.heroName?.line1 || '')}" />
          </div>
          <div class="input-group">
            <label for="set-hero-line2">Name Line 2 (styled outline)</label>
            <input type="text" id="set-hero-line2" value="${escHtml(s.heroName?.line2 || '')}" />
          </div>
          <div class="input-group settings-grid-full">
            <label for="set-hero-desc">Hero Description</label>
            <textarea id="set-hero-desc" rows="3">${escHtml(s.heroDescription)}</textarea>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap:0.75rem;">
        <button class="btn btn-primary" id="save-settings-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Settings
        </button>
      </div>
    `;

    document.getElementById('save-settings-btn').addEventListener('click', async () => {
      const siteData = {
        title: document.getElementById('set-title').value,
        logo: document.getElementById('set-logo').value,
        tagline: document.getElementById('set-tagline').value,
        footerText: document.getElementById('set-footer').value,
        heroName: {
          line1: document.getElementById('set-hero-line1').value,
          line2: document.getElementById('set-hero-line2').value
        },
        heroDescription: document.getElementById('set-hero-desc').value
      };

      try {
        await api('/api/admin/site', { method: 'PUT', body: JSON.stringify(siteData) });
        showToast('Settings saved', 'success');
        await loadData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ============================================
  // UTILITY
  // ============================================
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================
  // INIT
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    checkAuth();
  });

  // Expose for inline handlers
  window._admin = {
    switchView,
    openProjectModal,
    closeModal
  };

})();
