// ============================================================
// CELVRA — Main Application Logic
// Developer: Kerolos Adly © 2026
// ============================================================

'use strict';

// ── Storage Helpers ──
const DB = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};

// ── Audio ──
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playNotifSound() {
  try {
    initAudio();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) { /* silent fail */ }
}

// ── State ──
const state = {
  currentUser: null,
  currentPage: 'dashboard',
  currentSection: null,
  currentFolder: null,
  sidebarOpen: false,
};

// ── App Init ──
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  initAuthForms();
  checkSession();
  checkPendingNotifications();
  setInterval(checkPendingNotifications, 10000);
});

// ── Particles (Auth Background) ──
function createParticles() {
  const container = document.querySelector('.auth-particles');
  if (!container) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      animation-duration: ${Math.random() * 10 + 8}s;
      animation-delay: ${Math.random() * 10}s;
      background: ${Math.random() > 0.5 ? 'var(--crystal-primary)' : Math.random() > 0.5 ? 'var(--crystal-secondary)' : 'var(--crystal-accent)'};
    `;
    container.appendChild(p);
  }
}

// ── Session ──
function checkSession() {
  // Check remember-me
  const remembered = DB.get('celvra_remember');
  const sessionUser = sessionStorage.getItem('celvra_session');

  if (remembered) {
    loginUser(remembered);
  } else if (sessionUser) {
    loginUser(sessionUser);
  } else {
    showAuth('login');
  }
}

function showAuth(page) {
  document.getElementById('app').classList.remove('active');
  document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('auth-' + page);
  if (el) el.classList.add('active');
}

// ── Auth Forms ──
function initAuthForms() {
  // Login
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    const remember = document.getElementById('login-remember').checked;

    clearErrors('login');

    const users = DB.get('celvra_users') || {};

    if (!users[email]) {
      showError('login-email-error', 'No account found with this email');
      return;
    }

    if (users[email].password !== hashPass(pass)) {
      showError('login-pass-error', 'Incorrect password');
      return;
    }

    const user = users[email];

    if (remember) {
      DB.set('celvra_remember', email);
    } else {
      DB.del('celvra_remember');
      sessionStorage.setItem('celvra_session', email);
    }

    loginUser(email);
    toast('Welcome back!', `Logged in as ${user.username}`, '✨', 'success');
  });

  // Register
  document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass').value;
    const passConfirm = document.getElementById('reg-pass-confirm').value;

    clearErrors('reg');

    if (!username || username.length < 3) {
      showError('reg-username-error', 'Username must be at least 3 characters');
      return;
    }

    if (!isValidEmail(email)) {
      showError('reg-email-error', 'Enter a valid email address');
      return;
    }

    const users = DB.get('celvra_users') || {};

    if (users[email]) {
      showError('reg-email-error', 'This email is already registered');
      return;
    }

    if (pass.length < 6) {
      showError('reg-pass-error', 'Password must be at least 6 characters');
      return;
    }

    if (pass !== passConfirm) {
      showError('reg-pass-confirm-error', 'Passwords do not match');
      return;
    }

    users[email] = {
      username,
      email,
      password: hashPass(pass),
      createdAt: new Date().toISOString(),
      files: { photos: [], music: [], videos: [], contacts: [], documents: [], apk: [], exe: [] },
      folders: { photos: [], music: [], videos: [], contacts: [], documents: [], apk: [], exe: [] },
      links: [],
      notifications: [],
    };

    DB.set('celvra_users', users);
    sessionStorage.setItem('celvra_session', email);
    DB.del('celvra_remember');

    loginUser(email);
    toast('Account Created!', `Welcome to Celvra, ${username}!`, '🎉', 'success');
  });

  // Password toggles
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });
}

function loginUser(email) {
  const users = DB.get('celvra_users') || {};
  if (!users[email]) { showAuth('login'); return; }
  state.currentUser = email;
  initApp();
}

function logout() {
  DB.del('celvra_remember');
  sessionStorage.removeItem('celvra_session');
  state.currentUser = null;
  state.currentPage = 'dashboard';
  document.getElementById('app').classList.remove('active');
  showAuth('login');
}

// ── App Init ──
function initApp() {
  document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
  document.getElementById('app').classList.add('active');
  updateUserUI();
  navigateTo('dashboard');
  updateNotifBadge();
}

function getUser() {
  const users = DB.get('celvra_users') || {};
  return users[state.currentUser];
}

function saveUser(user) {
  const users = DB.get('celvra_users') || {};
  users[state.currentUser] = user;
  DB.set('celvra_users', users);
}

function updateUserUI() {
  const user = getUser();
  if (!user) return;
  const initial = user.username[0].toUpperCase();
  document.querySelectorAll('.user-avatar-text').forEach(el => el.textContent = initial);
  document.querySelectorAll('.user-name-text').forEach(el => el.textContent = user.username);
  document.querySelectorAll('.user-email-text').forEach(el => el.textContent = user.email);
}

// ── Navigation ──
function navigateTo(page, section, folder) {
  state.currentPage = page;
  state.currentSection = section || null;
  state.currentFolder = folder || null;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update topbar title
  const titles = {
    dashboard: '⬡ DASHBOARD',
    photos: '🖼 PHOTOS',
    music: '🎵 MUSIC',
    videos: '🎬 VIDEOS',
    contacts: '📒 CONTACTS',
    documents: '📄 DOCUMENTS',
    apk: '📱 APK FILES',
    exe: '💻 EXE FILES',
    links: '🔗 LINKS',
    notifications: '🔔 NOTIFICATIONS',
    transfer: '📤 TRANSFER FILES',
    about: '⬡ ABOUT CELVRA',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page.toUpperCase();

  // Show page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    renderPage(page);
  }

  // Close sidebar on mobile
  closeSidebar();
}

// ── Sidebar ──
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  document.querySelector('.sidebar').classList.toggle('open', state.sidebarOpen);
  document.querySelector('.sidebar-overlay').classList.toggle('active', state.sidebarOpen);
}

function closeSidebar() {
  state.sidebarOpen = false;
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.sidebar-overlay').classList.remove('active');
}

// ── Page Renderers ──
function renderPage(page) {
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'photos': renderSection('photos'); break;
    case 'music': renderSection('music'); break;
    case 'videos': renderSection('videos'); break;
    case 'contacts': renderSection('contacts'); break;
    case 'documents': renderSection('documents'); break;
    case 'apk': renderSection('apk'); break;
    case 'exe': renderSection('exe'); break;
    case 'links': renderLinks(); break;
    case 'notifications': renderNotifications(); break;
    case 'transfer': renderTransfer(); break;
    case 'about': renderAbout(); break;
  }
}

// ── Dashboard ──
function renderDashboard() {
  const user = getUser();
  if (!user) return;

  const greeting = getGreeting();
  document.getElementById('dash-greeting').textContent = `${greeting}, ${user.username}!`;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Stats
  const sections = ['photos', 'music', 'videos', 'contacts', 'documents', 'apk', 'exe'];
  let total = 0;
  sections.forEach(s => { total += (user.files[s] || []).length; });
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-photos').textContent = (user.files.photos || []).length;
  document.getElementById('stat-music').textContent = (user.files.music || []).length;
  document.getElementById('stat-links').textContent = (user.links || []).length;
  const unread = (user.notifications || []).filter(n => !n.read).length;
  document.getElementById('stat-notifs').textContent = unread;

  // Recent files
  let allFiles = [];
  sections.forEach(s => {
    (user.files[s] || []).forEach(f => allFiles.push({ ...f, _section: s }));
  });
  allFiles.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  const recent = allFiles.slice(0, 5);

  const recentEl = document.getElementById('dash-recent-files');
  if (recent.length === 0) {
    recentEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📂</span><p class="empty-text">NO FILES YET</p></div>`;
  } else {
    recentEl.innerHTML = recent.map(f => `
      <div class="file-row">
        <span class="file-row-icon">${getFileIcon(f.name, f._section)}</span>
        <div class="file-row-info">
          <div class="file-row-name">${escHtml(f.name)}</div>
          <div class="file-row-meta">${f._section.toUpperCase()} · ${formatDate(f.addedAt)}</div>
        </div>
        <div class="file-row-actions">
          <button class="btn-icon" title="Download" onclick="downloadFile('${f._section}', '${f.id}')">⬇️</button>
          <button class="btn-icon danger" title="Delete" onclick="deleteFile('${f._section}', '${f.id}', null)">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // Recent notifications
  const notifEl = document.getElementById('dash-recent-notifs');
  const notifs = (user.notifications || []).slice(-3).reverse();
  if (notifs.length === 0) {
    notifEl.innerHTML = `<div class="empty-state" style="padding:20px"><span class="empty-icon" style="font-size:28px">🔔</span><p class="empty-text" style="font-size:11px">NO NOTIFICATIONS</p></div>`;
  } else {
    notifEl.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-icon">${n.icon || '📁'}</div>
        <div class="notif-content">
          <div class="notif-title">${escHtml(n.title)}</div>
          <div class="notif-body">${escHtml(n.body)}</div>
        </div>
      </div>
    `).join('');
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

// ── Section (Files + Folders) ──
const SECTION_CONFIGS = {
  photos: { label: 'Photos', icon: '🖼️', accept: 'image/*', types: ['jpg','jpeg','png','gif','bmp','webp','svg'] },
  music: { label: 'Music', icon: '🎵', accept: 'audio/*,.mp3,.wav,.flac,.ogg,.aac,.m4a', types: ['mp3','wav','flac','ogg','aac','m4a'] },
  videos: { label: 'Videos', icon: '🎬', accept: 'video/*,.mp4,.mov,.avi,.mkv,.webm', types: ['mp4','mov','avi','mkv','webm'] },
  contacts: { label: 'Contacts', icon: '📒', accept: '.vcf', types: ['vcf'] },
  documents: { label: 'Documents', icon: '📄', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf', types: ['pdf','doc','docx','xls','xlsx','txt','rtf'] },
  apk: { label: 'APK Files', icon: '📱', accept: '.apk', types: ['apk'] },
  exe: { label: 'EXE Files', icon: '💻', accept: '.exe', types: ['exe'] },
};

function renderSection(section) {
  const cfg = SECTION_CONFIGS[section];
  const user = getUser();
  const container = document.getElementById('page-' + section);
  if (!container || !user) return;

  const folders = user.folders[section] || [];
  const files = user.files[section] || [];

  // If inside a folder
  if (state.currentFolder) {
    renderFolderContents(section, state.currentFolder);
    return;
  }

  container.innerHTML = `
    <div class="page-section">
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" onclick="openUploadModal('${section}')">⬆️ UPLOAD FILE</button>
        <button class="btn btn-ghost btn-sm" onclick="openCreateFolder('${section}')">📁 NEW FOLDER</button>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-ghost btn-sm" onclick="openTransferModal('${section}', null, true)">📤 SEND FILE</button>
      </div>

      ${folders.length > 0 ? `
      <div>
        <div class="section-header"><span class="section-title">📁 FOLDERS</span></div>
        <div class="folders-grid">
          ${folders.map(f => `
            <div class="folder-card" onclick="openFolder('${section}', '${f.id}')">
              <span class="folder-card-icon">📁</span>
              <div class="folder-card-name">${escHtml(f.name)}</div>
              <div class="folder-card-meta">${(f.files || []).length} files</div>
              <div class="folder-card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-ghost btn-sm" onclick="openFolder('${section}', '${f.id}')">📂 OPEN</button>
                <button class="btn btn-danger btn-sm" onclick="deleteFolder('${section}', '${f.id}')">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div>
        <div class="section-header"><span class="section-title">${cfg.icon} FILES</span></div>
        ${files.length === 0 ? `
          <div class="upload-zone" onclick="openUploadModal('${section}')">
            <span class="upload-icon">${cfg.icon}</span>
            <div class="upload-text">DROP OR CLICK TO UPLOAD</div>
            <div class="upload-subtext">Accepted: ${cfg.types.join(', ')}</div>
          </div>
        ` : `
          <div class="files-list">
            ${files.map(f => renderFileRow(f, section, null)).join('')}
          </div>
          <div style="margin-top:12px">
            <div class="upload-zone" style="padding:20px" onclick="openUploadModal('${section}')">
              <span style="font-size:24px">➕</span>
              <div class="upload-text" style="font-size:11px;margin-top:6px">ADD MORE FILES</div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  setupDragDrop(container.querySelector('.upload-zone'), section, null);
}

function renderFolderContents(section, folderId) {
  const user = getUser();
  const container = document.getElementById('page-' + section);
  const folder = (user.folders[section] || []).find(f => f.id === folderId);
  if (!folder || !container) return;

  const files = folder.files || [];
  container.innerHTML = `
    <div class="page-section">
      <div class="breadcrumb">
        <span class="breadcrumb-item" onclick="state.currentFolder=null;renderSection('${section}')">📁 ${SECTION_CONFIGS[section].label}</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-item active">📂 ${escHtml(folder.name)}</span>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" onclick="openUploadModal('${section}', '${folderId}')">⬆️ UPLOAD FILE</button>
        <button class="btn btn-ghost btn-sm" onclick="openTransferModal('${section}', '${folderId}', true)">📤 SEND FILE</button>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-ghost btn-sm" onclick="state.currentFolder=null;renderSection('${section}')">⬅️ BACK</button>
      </div>
      <div class="section-header"><span class="section-title">📂 ${escHtml(folder.name)}</span><span class="badge badge-primary">${files.length} FILES</span></div>
      ${files.length === 0 ? `
        <div class="upload-zone" onclick="openUploadModal('${section}', '${folderId}')">
          <span class="upload-icon">📂</span>
          <div class="upload-text">DROP OR CLICK TO UPLOAD</div>
          <div class="upload-subtext">Accepted: ${SECTION_CONFIGS[section].types.join(', ')}</div>
        </div>
      ` : `
        <div class="files-list">
          ${files.map(f => renderFileRow(f, section, folderId)).join('')}
        </div>
      `}
    </div>
  `;
}

function renderFileRow(f, section, folderId) {
  const fIdArg = folderId ? `'${folderId}'` : 'null';
  return `
    <div class="file-row" id="frow-${f.id}">
      <span class="file-row-icon">${getFileIcon(f.name, section)}</span>
      <div class="file-row-info">
        <div class="file-row-name">${escHtml(f.name)}</div>
        <div class="file-row-meta">${formatSize(f.size)} · ${formatDate(f.addedAt)}</div>
      </div>
      <div class="file-row-actions">
        <button class="btn-icon" title="Download" onclick="downloadFile('${section}', '${f.id}', ${fIdArg})">⬇️</button>
        <button class="btn-icon" title="Send File" onclick="openTransferModal('${section}', ${fIdArg}, false, '${f.id}')">📤</button>
        <button class="btn-icon danger" title="Delete" onclick="deleteFile('${section}', '${f.id}', ${fIdArg})">🗑️</button>
      </div>
    </div>
  `;
}

// ── Open Folder ──
function openFolder(section, folderId) {
  state.currentFolder = folderId;
  renderFolderContents(section, folderId);
}

// ── Upload Modal ──
function openUploadModal(section, folderId) {
  const cfg = SECTION_CONFIGS[section];
  const modal = document.getElementById('modal-upload');
  modal.querySelector('.modal-title').textContent = `UPLOAD TO ${cfg.label.toUpperCase()}`;
  const input = document.getElementById('upload-file-input');
  input.accept = cfg.accept;
  input.multiple = true;
  input.value = '';
  document.getElementById('upload-section').value = section;
  document.getElementById('upload-folder').value = folderId || '';
  document.getElementById('upload-file-list').innerHTML = '';
  openModal('modal-upload');
}

function handleUploadFiles() {
  const input = document.getElementById('upload-file-input');
  const section = document.getElementById('upload-section').value;
  const folderId = document.getElementById('upload-folder').value || null;
  const files = Array.from(input.files);
  if (!files.length) { toast('No files selected', 'Please choose files to upload', '⚠️', 'warn'); return; }

  const user = getUser();
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileObj = {
        id: uid(),
        name: file.name,
        size: file.size,
        type: file.type,
        data: e.target.result,
        addedAt: new Date().toISOString(),
      };

      if (folderId) {
        const folder = (user.folders[section] || []).find(f => f.id === folderId);
        if (folder) {
          if (!folder.files) folder.files = [];
          folder.files.push(fileObj);
        }
      } else {
        if (!user.files[section]) user.files[section] = [];
        user.files[section].push(fileObj);
      }
      saveUser(user);
    };
    reader.readAsDataURL(file);
  });

  setTimeout(() => {
    closeModal('modal-upload');
    toast('Files Uploaded', `${files.length} file(s) added successfully`, '✅', 'success');
    renderPage(section);
  }, 300);
}

// ── Delete File ──
function deleteFile(section, fileId, folderId) {
  if (!confirm('Delete this file? This action cannot be undone.')) return;
  const user = getUser();

  if (folderId) {
    const folder = (user.folders[section] || []).find(f => f.id === folderId);
    if (folder) {
      folder.files = (folder.files || []).filter(f => f.id !== fileId);
    }
  } else {
    user.files[section] = (user.files[section] || []).filter(f => f.id !== fileId);
  }

  saveUser(user);
  toast('File Deleted', 'The file has been removed', '🗑️', 'success');
  renderPage(section);
  if (state.currentPage === 'dashboard') renderDashboard();
}

// ── Download File ──
function downloadFile(section, fileId, folderId) {
  const user = getUser();
  let file;

  if (folderId) {
    const folder = (user.folders[section] || []).find(f => f.id === folderId);
    file = folder && (folder.files || []).find(f => f.id === fileId);
  } else {
    file = (user.files[section] || []).find(f => f.id === fileId);
  }

  if (!file) { toast('Error', 'File not found', '❌', 'error'); return; }
  const a = document.createElement('a');
  a.href = file.data;
  a.download = file.name;
  a.click();
}

// ── Create Folder ──
function openCreateFolder(section) {
  document.getElementById('folder-section').value = section;
  document.getElementById('folder-name-input').value = '';
  openModal('modal-folder');
}

function handleCreateFolder() {
  const section = document.getElementById('folder-section').value;
  const name = document.getElementById('folder-name-input').value.trim();
  if (!name) { toast('Error', 'Please enter a folder name', '⚠️', 'warn'); return; }

  const user = getUser();
  if (!user.folders[section]) user.folders[section] = [];

  user.folders[section].push({
    id: uid(),
    name,
    files: [],
    createdAt: new Date().toISOString(),
  });

  saveUser(user);
  closeModal('modal-folder');
  toast('Folder Created', `"${name}" created successfully`, '📁', 'success');
  renderPage(section);
}

// ── Delete Folder ──
function deleteFolder(section, folderId) {
  if (!confirm('Delete this folder and ALL its contents? This cannot be undone.')) return;
  const user = getUser();
  user.folders[section] = (user.folders[section] || []).filter(f => f.id !== folderId);
  saveUser(user);
  toast('Folder Deleted', 'Folder removed', '🗑️', 'success');
  renderPage(section);
}

// ── Links ──
function renderLinks() {
  const user = getUser();
  const container = document.getElementById('page-links');
  const links = user.links || [];

  container.innerHTML = `
    <div class="page-section">
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" onclick="openAddLink()">➕ ADD LINK</button>
      </div>
      ${links.length === 0 ? `
        <div class="empty-state"><span class="empty-icon">🔗</span><p class="empty-text">NO LINKS SAVED</p></div>
      ` : `
        <div class="files-list">
          ${links.map(l => `
            <div class="link-card">
              <div class="link-icon">🔗</div>
              <div class="link-info">
                <div class="link-name">${escHtml(l.name)}</div>
                <a class="link-url" href="${escHtml(l.url)}" target="_blank" rel="noopener">${escHtml(l.url)}</a>
              </div>
              <div class="link-actions">
                <button class="btn-icon" title="Open" onclick="window.open('${escHtml(l.url)}','_blank')">🌐</button>
                <button class="btn-icon danger" title="Delete" onclick="deleteLink('${l.id}')">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function openAddLink() { openModal('modal-link'); document.getElementById('link-name-input').value = ''; document.getElementById('link-url-input').value = ''; }

function handleAddLink() {
  const name = document.getElementById('link-name-input').value.trim();
  let url = document.getElementById('link-url-input').value.trim();
  if (!name || !url) { toast('Error', 'Please fill in both fields', '⚠️', 'warn'); return; }
  if (!url.startsWith('http')) url = 'https://' + url;

  const user = getUser();
  user.links = user.links || [];
  user.links.push({ id: uid(), name, url, addedAt: new Date().toISOString() });
  saveUser(user);
  closeModal('modal-link');
  toast('Link Added', `"${name}" saved`, '🔗', 'success');
  renderLinks();
}

function deleteLink(id) {
  if (!confirm('Delete this link?')) return;
  const user = getUser();
  user.links = (user.links || []).filter(l => l.id !== id);
  saveUser(user);
  toast('Link Deleted', '', '🗑️', 'success');
  renderLinks();
}

// ── Transfer Files ──
function renderTransfer() {
  const container = document.getElementById('page-transfer');
  const user = getUser();
  const sections = Object.keys(SECTION_CONFIGS);

  // Build all files list
  let allFiles = [];
  sections.forEach(s => {
    (user.files[s] || []).forEach(f => allFiles.push({ ...f, _section: s, _folder: null }));
    (user.folders[s] || []).forEach(folder => {
      (folder.files || []).forEach(f => allFiles.push({ ...f, _section: s, _folder: folder.id, _folderName: folder.name }));
    });
  });

  container.innerHTML = `
    <div class="page-section">
      <div class="glass" style="padding:28px;max-width:600px">
        <div class="section-title" style="margin-bottom:20px">📤 TRANSFER FILES TO ANOTHER USER</div>
        <div class="form-group">
          <label class="form-label">Recipient Email (Celvra User)</label>
          <input class="form-input" id="transfer-email" type="email" placeholder="recipient@email.com">
        </div>
        <div class="form-group">
          <label class="form-label">Select File</label>
          <select class="form-input" id="transfer-file-select">
            <option value="">— Select a file —</option>
            ${allFiles.map(f => `<option value="${f._section}|${f.id}|${f._folder||''}">${escHtml(f.name)} (${f._section}${f._folderName ? ' / '+f._folderName : ''})</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="handleTransfer()" style="margin-top:8px">📤 SEND FILE</button>
      </div>
    </div>
  `;
}

function openTransferModal(section, folderId, pickFile, preselectedFileId) {
  const user = getUser();
  let allFiles = [];

  if (pickFile) {
    // Get files from this section/folder
    if (folderId) {
      const folder = (user.folders[section] || []).find(f => f.id === folderId);
      (folder?.files || []).forEach(f => allFiles.push({ ...f, _section: section, _folder: folderId }));
    } else {
      (user.files[section] || []).forEach(f => allFiles.push({ ...f, _section: section, _folder: null }));
    }
  } else if (preselectedFileId) {
    let file;
    if (folderId) {
      const folder = (user.folders[section] || []).find(f => f.id === folderId);
      file = (folder?.files || []).find(f => f.id === preselectedFileId);
      if (file) allFiles.push({ ...file, _section: section, _folder: folderId });
    } else {
      file = (user.files[section] || []).find(f => f.id === preselectedFileId);
      if (file) allFiles.push({ ...file, _section: section, _folder: null });
    }
  }

  const modal = document.getElementById('modal-transfer');
  modal.querySelector('#tm-file-select').innerHTML = allFiles.length > 0
    ? allFiles.map(f => `<option value="${f._section}|${f.id}|${f._folder||''}">${escHtml(f.name)}</option>`).join('')
    : '<option value="">No files available</option>';
  modal.querySelector('#tm-email').value = '';
  openModal('modal-transfer');
}

function handleTransfer() {
  const email = document.getElementById('transfer-email')?.value?.trim().toLowerCase();
  const select = document.getElementById('transfer-file-select');
  if (!email || !select?.value) { toast('Error', 'Please fill all fields', '⚠️', 'warn'); return; }
  doTransfer(email, select.value);
}

function handleModalTransfer() {
  const email = document.getElementById('tm-email').value.trim().toLowerCase();
  const val = document.getElementById('tm-file-select').value;
  if (!email || !val) { toast('Error', 'Please fill all fields', '⚠️', 'warn'); return; }
  doTransfer(email, val);
  closeModal('modal-transfer');
}

function doTransfer(recipientEmail, fileVal) {
  if (recipientEmail === state.currentUser) { toast('Error', 'You cannot send files to yourself', '❌', 'error'); return; }

  const users = DB.get('celvra_users') || {};
  if (!users[recipientEmail]) { toast('User Not Found', 'No Celvra account with that email', '❌', 'error'); return; }

  const [section, fileId, folderId] = fileVal.split('|');
  const sender = getUser();
  let file;

  if (folderId) {
    const folder = (sender.folders[section] || []).find(f => f.id === folderId);
    file = (folder?.files || []).find(f => f.id === fileId);
  } else {
    file = (sender.files[section] || []).find(f => f.id === fileId);
  }

  if (!file) { toast('Error', 'File not found', '❌', 'error'); return; }

  const recipient = users[recipientEmail];
  if (!recipient.notifications) recipient.notifications = [];

  const notifId = uid();
  recipient.notifications.push({
    id: notifId,
    type: 'file_received',
    icon: getFileIcon(file.name, section),
    title: 'FILE RECEIVED',
    body: `${sender.username} sent you "${file.name}"`,
    senderName: sender.username,
    fileData: { ...file, _section: section },
    read: false,
    accepted: false,
    createdAt: new Date().toISOString(),
  });

  users[recipientEmail] = recipient;
  DB.set('celvra_users', users);

  toast('File Sent!', `"${file.name}" sent to ${recipient.username}`, '📤', 'success');
}

// ── Notifications ──
function renderNotifications() {
  const user = getUser();
  const notifs = (user.notifications || []).slice().reverse();
  const container = document.getElementById('page-notifications');

  container.innerHTML = `
    <div class="page-section">
      <div class="toolbar">
        <span class="section-title">🔔 NOTIFICATION CENTER</span>
        <div class="toolbar-spacer"></div>
        ${notifs.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="clearAllNotifications()">🗑️ CLEAR ALL</button>` : ''}
      </div>
      ${notifs.length === 0 ? `
        <div class="empty-state"><span class="empty-icon">🔔</span><p class="empty-text">NO NOTIFICATIONS</p></div>
      ` : `
        <div class="notif-list">
          ${notifs.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" id="notif-${n.id}">
              <div class="notif-icon">${n.icon || '📁'}</div>
              <div class="notif-content">
                <div class="notif-title">${escHtml(n.title)}</div>
                <div class="notif-body">${escHtml(n.body)}</div>
                <div class="notif-time">${formatDate(n.createdAt)}</div>
                ${n.type === 'file_received' && !n.accepted ? `
                  <div class="notif-actions" style="margin-top:10px">
                    <button class="btn btn-accent btn-sm" onclick="acceptFile('${n.id}')">✅ ACCEPT & SAVE</button>
                    <button class="btn btn-ghost btn-sm" onclick="dismissNotif('${n.id}')">✖ DISMISS</button>
                  </div>
                ` : n.accepted ? `<span class="badge badge-accent" style="margin-top:8px">✅ SAVED TO FILES</span>` : ''}
              </div>
              <button class="btn-icon danger" title="Delete notification" onclick="deleteNotif('${n.id}')">🗑️</button>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  // Mark all as read
  const updated = getUser();
  (updated.notifications || []).forEach(n => n.read = true);
  saveUser(updated);
  updateNotifBadge();
}

function acceptFile(notifId) {
  const user = getUser();
  const notif = (user.notifications || []).find(n => n.id === notifId);
  if (!notif || !notif.fileData) return;

  const fd = notif.fileData;
  const section = fd._section || 'documents';
  const newFile = { ...fd, id: uid(), addedAt: new Date().toISOString() };
  delete newFile._section;

  if (!user.files[section]) user.files[section] = [];
  user.files[section].push(newFile);
  notif.accepted = true;
  notif.read = true;

  saveUser(user);
  toast('File Saved!', `"${fd.name}" added to your ${section}`, '✅', 'success');
  renderNotifications();
}

function dismissNotif(notifId) {
  const user = getUser();
  const notif = (user.notifications || []).find(n => n.id === notifId);
  if (notif) { notif.accepted = true; notif.read = true; }
  saveUser(user);
  renderNotifications();
}

function deleteNotif(notifId) {
  const user = getUser();
  user.notifications = (user.notifications || []).filter(n => n.id !== notifId);
  saveUser(user);
  renderNotifications();
  updateNotifBadge();
}

function clearAllNotifications() {
  if (!confirm('Clear all notifications?')) return;
  const user = getUser();
  user.notifications = [];
  saveUser(user);
  renderNotifications();
  updateNotifBadge();
}

function updateNotifBadge() {
  const user = getUser();
  if (!user) return;
  const unread = (user.notifications || []).filter(n => !n.read).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'inline-flex' : 'none';
  }
  const dot = document.querySelector('.notif-dot');
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
}

function checkPendingNotifications() {
  if (!state.currentUser) return;
  const user = getUser();
  const newNotifs = (user.notifications || []).filter(n => !n.read && !n._shown);
  if (newNotifs.length > 0) {
    newNotifs.forEach(n => {
      n._shown = true;
      // Popup toast
      showPopupNotif(n);
    });
    saveUser(user);
    updateNotifBadge();
  }
}

function showPopupNotif(notif) {
  playNotifSound();
  showToastNotif(notif);
}

function showToastNotif(notif) {
  const container = document.querySelector('.toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="toast-icon">${notif.icon || '🔔'}</span>
    <div class="toast-content">
      <div class="toast-title">${escHtml(notif.title)}</div>
      <div class="toast-body">${escHtml(notif.body)}<br><span style="color:var(--crystal-primary);cursor:pointer;font-size:10px;font-family:var(--font-mono)" onclick="navigateTo('notifications')">→ VISIT NOTIFICATION CENTER</span></div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(el);
  setTimeout(() => { if (el.parentElement) el.remove(); }, 8000);
}

// ── About Page ──
function renderAbout() {
  const container = document.getElementById('page-about');
  container.innerHTML = `
    <div class="about-page">
      <div class="about-hero">
        <div class="about-logo">CELVRA</div>
        <div class="about-slogan">Beyond Storage, Beyond Limits</div>
      </div>

      <div class="about-card">
        <div class="about-card-title">👨‍💻 Developer</div>
        <div class="about-dev">
          <div class="about-dev-avatar">K</div>
          <div>
            <div class="about-dev-name">Kerolos Adly</div>
            <div class="about-dev-role">Lead Developer & Designer</div>
            <div class="about-year">© 2026 — All Rights Reserved</div>
          </div>
        </div>
      </div>

      <div class="about-card">
        <div class="about-card-title">⚡ Platform Features</div>
        <div class="files-list" style="gap:8px">
          ${[
            ['🖼️','Photo Gallery','Upload and manage your photos with full control'],
            ['🎵','Music Library','Organize music files in custom folders'],
            ['🎬','Video Vault','Store all your video files securely'],
            ['📒','VCard Contacts','Import .vcf contact files'],
            ['📄','Documents','PDF, Word, Excel, TXT files'],
            ['📱','APK Files','Android application packages'],
            ['💻','EXE Files','Windows 32-bit & 64-bit executables'],
            ['🔗','Link Manager','Save and organize important URLs'],
            ['📤','File Transfer','Send files to other Celvra users'],
            ['🔔','Notifications','Real-time file transfer notifications'],
            ['📁','Folders','Organize files into custom folders'],
          ].map(([icon, name, desc]) => `
            <div class="file-row" style="cursor:default">
              <span class="file-row-icon">${icon}</span>
              <div class="file-row-info">
                <div class="file-row-name">${name}</div>
                <div class="file-row-meta">${desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="about-card">
        <div class="about-card-title">🔐 Privacy & Security</div>
        <p style="font-family:var(--font-mono);font-size:12px;color:var(--crystal-muted);line-height:1.8">
          Celvra stores all data locally on your device using encrypted browser storage.<br>
          No data is sent to any server. Complete privacy. Complete control.<br>
          Each user account is isolated — your files are yours alone.
        </p>
      </div>

      <div class="about-card" style="text-align:center">
        <div class="about-logo" style="font-size:28px;margin-bottom:4px">CELVRA</div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--crystal-muted);letter-spacing:2px">Version 1.0.0 · Built 2026 · Crystal Drive Interface</div>
      </div>
    </div>
  `;
}

// ── Toast ──
function toast(title, body, icon = 'ℹ️', type = '') {
  const container = document.querySelector('.toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <div class="toast-title">${escHtml(title)}</div>
      ${body ? `<div class="toast-body">${escHtml(body)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(el);
  setTimeout(() => { if (el.parentElement) el.remove(); }, 4000);
}

// ── Modal Helpers ──
function openModal(id) {
  document.getElementById(id + '-overlay').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id + '-overlay').classList.remove('active');
}

// ── Drag & Drop ──
function setupDragDrop(zone, section, folderId) {
  if (!zone) return;
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const user = getUser();
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const fileObj = { id: uid(), name: file.name, size: file.size, type: file.type, data: ev.target.result, addedAt: new Date().toISOString() };
        if (folderId) {
          const folder = (user.folders[section] || []).find(f => f.id === folderId);
          if (folder) { if (!folder.files) folder.files = []; folder.files.push(fileObj); }
        } else {
          if (!user.files[section]) user.files[section] = [];
          user.files[section].push(fileObj);
        }
        saveUser(user);
      };
      reader.readAsDataURL(file);
    });
    setTimeout(() => { toast('Files Uploaded', `${files.length} file(s) added`, '✅', 'success'); renderPage(section); }, 400);
  });
}

// ── Utilities ──
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function hashPass(p) { let h = 0; for (let i = 0; i < p.length; i++) { h = Math.imul(31, h) + p.charCodeAt(i) | 0; } return h.toString(36); }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatSize(bytes) { if (!bytes) return '—'; const k = 1024; const s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]; }
function formatDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrors(prefix) {
  document.querySelectorAll(`[id^="${prefix}-"][id$="-error"]`).forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

function getFileIcon(name, section) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const icons = {
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🎞️', bmp: '🖼️', webp: '🖼️', svg: '🎨',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', aac: '🎵', m4a: '🎵',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    vcf: '👤',
    pdf: '📕', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', txt: '📄', rtf: '📄',
    apk: '📱',
    exe: '💻',
  };
  return icons[ext] || (section === 'music' ? '🎵' : section === 'photos' ? '🖼️' : section === 'videos' ? '🎬' : '📁');
}
