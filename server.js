const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Paths ---
const DATA_DIR = path.join(__dirname, 'data');
const PORTFOLIO_PATH = path.join(DATA_DIR, 'portfolio.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Helpers ---
function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set true behind HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// --- Static File Serving ---
// Admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Portfolio static files (CSS, JS, images, data)
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/main.js', express.static(path.join(__dirname, 'main.js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/data', express.static(DATA_DIR));

// Portfolio index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// PUBLIC API
// ============================================

// Get portfolio data (public, for frontend rendering)
app.get('/api/data', (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  if (!data) return res.status(500).json({ error: 'Data not found' });

  // Filter out hidden/draft projects and invisible sections for public view
  const publicData = {
    ...data,
    sections: data.sections
      .filter(s => s.visible)
      .sort((a, b) => a.order - b.order),
    projects: data.projects
      .filter(p => p.status === 'published')
      .sort((a, b) => a.order - b.order)
  };

  res.json(publicData);
});

// ============================================
// AUTH API
// ============================================

app.post('/api/auth/setup', (req, res) => {
  const auth = readJSON(AUTH_PATH);
  if (auth && auth.setupComplete) {
    return res.status(403).json({ error: 'Setup already completed' });
  }

  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hash = bcrypt.hashSync(password, 12);
  writeJSON(AUTH_PATH, { passwordHash: hash, setupComplete: true });
  req.session.authenticated = true;
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const auth = readJSON(AUTH_PATH);
  if (!auth || !auth.setupComplete) {
    return res.status(400).json({ error: 'Setup not complete', needsSetup: true });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (bcrypt.compareSync(password, auth.passwordHash)) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/auth/check', (req, res) => {
  const auth = readJSON(AUTH_PATH);
  const needsSetup = !auth || !auth.setupComplete;
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    needsSetup
  });
});

// ============================================
// ADMIN API (all require auth)
// ============================================

// --- Full Data ---
app.get('/api/admin/data', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  if (!data) return res.status(500).json({ error: 'Data not found' });
  res.json(data);
});

// --- Site Settings ---
app.put('/api/admin/site', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  if (!data) return res.status(500).json({ error: 'Data not found' });

  data.site = { ...data.site, ...req.body };
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, site: data.site });
});

// --- Sections ---
app.get('/api/admin/sections', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  res.json(data.sections.sort((a, b) => a.order - b.order));
});

app.post('/api/admin/sections', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const { type, navLabel } = req.body;

  const newSection = {
    id: `section-${generateId()}`,
    type: type || 'custom',
    navLabel: navLabel || 'NEW SECTION',
    visible: true,
    order: data.sections.length,
    content: req.body.content || {}
  };

  data.sections.push(newSection);
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, section: newSection });
});

app.put('/api/admin/sections/:id', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const index = data.sections.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Section not found' });

  data.sections[index] = { ...data.sections[index], ...req.body, id: req.params.id };
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, section: data.sections[index] });
});

app.delete('/api/admin/sections/:id', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const index = data.sections.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Section not found' });

  // Prevent deleting core sections
  const coreTypes = ['hero', 'about', 'work', 'contact'];
  if (coreTypes.includes(data.sections[index].type)) {
    return res.status(400).json({ error: 'Cannot delete core sections' });
  }

  data.sections.splice(index, 1);
  // Re-order remaining
  data.sections.forEach((s, i) => s.order = i);
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true });
});

app.post('/api/admin/sections/reorder', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds array required' });
  }

  orderedIds.forEach((id, index) => {
    const section = data.sections.find(s => s.id === id);
    if (section) section.order = index;
  });

  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true });
});

// --- Projects ---
app.get('/api/admin/projects', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  res.json(data.projects.sort((a, b) => a.order - b.order));
});

app.post('/api/admin/projects', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const now = new Date().toISOString();

  const newProject = {
    id: `proj-${generateId()}`,
    title: req.body.title || 'Untitled Project',
    category: req.body.category || '',
    description: req.body.description || '',
    tags: req.body.tags || [],
    image: req.body.image || '',
    link: req.body.link || '#',
    linkTarget: req.body.linkTarget || '_self',
    status: req.body.status || 'draft',
    featured: req.body.featured || false,
    order: data.projects.length,
    metrics: req.body.metrics || {},
    createdAt: now,
    updatedAt: now
  };

  data.projects.push(newProject);
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, project: newProject });
});

app.put('/api/admin/projects/:id', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const index = data.projects.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  data.projects[index] = {
    ...data.projects[index],
    ...req.body,
    id: req.params.id,
    updatedAt: new Date().toISOString()
  };

  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, project: data.projects[index] });
});

app.delete('/api/admin/projects/:id', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const index = data.projects.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  data.projects.splice(index, 1);
  data.projects.forEach((p, i) => p.order = i);
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true });
});

app.post('/api/admin/projects/reorder', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds array required' });
  }

  orderedIds.forEach((id, index) => {
    const proj = data.projects.find(p => p.id === id);
    if (proj) proj.order = index;
  });

  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true });
});

app.post('/api/admin/projects/:id/duplicate', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const original = data.projects.find(p => p.id === req.params.id);
  if (!original) return res.status(404).json({ error: 'Project not found' });

  const now = new Date().toISOString();
  const duplicate = {
    ...JSON.parse(JSON.stringify(original)),
    id: `proj-${generateId()}`,
    title: `${original.title} (Copy)`,
    status: 'draft',
    order: data.projects.length,
    createdAt: now,
    updatedAt: now
  };

  data.projects.push(duplicate);
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, project: duplicate });
});

app.post('/api/admin/projects/bulk-delete', requireAuth, (req, res) => {
  const data = readJSON(PORTFOLIO_PATH);
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array required' });
  }

  data.projects = data.projects.filter(p => !ids.includes(p.id));
  data.projects.forEach((p, i) => p.order = i);
  writeJSON(PORTFOLIO_PATH, data);
  res.json({ success: true, deletedCount: ids.length });
});

// --- Media Upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${generateId()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

app.post('/api/admin/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `./uploads/${req.file.filename}`
    }
  });
});

app.get('/api/admin/uploads', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(f))
      .map(filename => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
        return {
          filename,
          url: `/uploads/${filename}`,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json(files);
  } catch {
    res.json([]);
  }
});

app.delete('/api/admin/upload/:filename', requireAuth, (req, res) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);

  // Security: prevent path traversal
  if (!filepath.startsWith(UPLOADS_DIR)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  fs.unlinkSync(filepath);
  res.json({ success: true });
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message });
  }
  next();
});

// ============================================
// START
// ============================================
app.listen(PORT, () => {
  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │                                          │`);
  console.log(`  │   Portfolio Server Running                │`);
  console.log(`  │                                          │`);
  console.log(`  │   Portfolio:  http://localhost:${PORT}        │`);
  console.log(`  │   Admin:     http://localhost:${PORT}/admin  │`);
  console.log(`  │                                          │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  const auth = readJSON(AUTH_PATH);
  if (!auth || !auth.setupComplete) {
    console.log('  ⚠  First-time setup: Visit /admin to set your password.\n');
  }
});
