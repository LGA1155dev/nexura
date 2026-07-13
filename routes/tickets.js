const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Extensões claramente perigosas são bloqueadas; o restante é permitido
// para não travar formatos legítimos usados pelos times de suporte
// (imagens, PDFs, planilhas, prints de tela, logs de sistema, etc.)
const BLOCKED_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.msi', '.php', '.jsp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    cb(null, true);
  }
});

function isStaff(user) {
  return user && (user.role === 'agent' || user.role === 'admin');
}

router.get('/dashboard', requireAuth, (req, res) => {
  const user = req.user;
  const scopeClause = isStaff(user) ? '' : 'user_id = ?';
  const params = isStaff(user) ? [] : [user.id];

  const openWhere = scopeClause ? `${scopeClause} AND status != 'closed'` : `status != 'closed'`;
  const totalWhere = scopeClause || '1=1';

  const openCount = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE ${openWhere}`).get(...params);
  const totalCount = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE ${totalWhere}`).get(...params);

  const recent = isStaff(user)
    ? db.prepare(`SELECT tickets.*, users.name as owner_name FROM tickets JOIN users ON tickets.user_id = users.id ORDER BY tickets.created_at DESC LIMIT 6`).all()
    : db.prepare(`SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`).all(user.id);

  res.render('dashboard', {
    title: 'Painel',
    openCount: openCount.c,
    totalCount: totalCount.c,
    recent
  });
});

router.get('/tickets', requireAuth, (req, res) => {
  const user = req.user;
  const { search, category, sort, order, status } = req.query;

  const allowedOrder = ['asc', 'desc'];
  const safeOrder = allowedOrder.includes((order || '').toLowerCase()) ? order.toUpperCase() : 'DESC';
  const sortField = sort || 'created_at';

  let sql = `SELECT tickets.*, users.name as owner_name FROM tickets JOIN users ON tickets.user_id = users.id WHERE 1=1`;
  const params = [];

  if (!isStaff(user)) {
    sql += ` AND tickets.user_id = ?`;
    params.push(user.id);
  }

  if (status) {
    sql += ` AND tickets.status = ?`;
    params.push(status);
  }

  if (category) {
    // Filtro rápido por categoria (suporta múltiplos valores separados por vírgula)
    sql += ` AND tickets.category IN (${category.split(',').map(c => `'${c.trim()}'`).join(',')})`;
  }

  if (search) {
    sql += ` AND (tickets.subject LIKE ? OR tickets.description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  // Ordenação configurável para as colunas da tabela
  sql += ` ORDER BY tickets.${sortField} ${safeOrder}`;

  const tickets = db.prepare(sql).all(...params);

  res.render('tickets-list', {
    title: 'Chamados',
    tickets,
    isStaff: isStaff(user),
    filters: { search: search || '', category: category || '', sort: sortField, order: safeOrder, status: status || '' }
  });
});

router.get('/tickets/new', requireAuth, (req, res) => {
  res.render('ticket-new', { title: 'Novo chamado', error: null });
});

router.post('/tickets/new', requireAuth, (req, res) => {
  const { subject, description, category, priority } = req.body;
  if (!subject || !description) {
    return res.render('ticket-new', { title: 'Novo chamado', error: 'Preencha assunto e descrição.' });
  }
  const allowedCategories = ['access', 'hardware', 'software', 'network', 'general'];
  const allowedPriorities = ['low', 'normal', 'high'];

  const info = db.prepare(`
    INSERT INTO tickets (user_id, subject, description, category, priority, status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `).run(
    req.user.id,
    subject,
    description,
    allowedCategories.includes(category) ? category : 'general',
    allowedPriorities.includes(priority) ? priority : 'normal'
  );

  res.redirect(`/tickets/${info.lastInsertRowid}`);
});

function loadTicketOr403(req, res) {
  const ticket = db.prepare(`
    SELECT tickets.*, users.name as owner_name, users.email as owner_email
    FROM tickets JOIN users ON tickets.user_id = users.id
    WHERE tickets.id = ?
  `).get(req.params.id);

  if (!ticket) {
    res.status(404).render('error', { title: 'Não encontrado', message: 'Chamado não encontrado.' });
    return null;
  }

  if (!isStaff(req.user) && ticket.user_id !== req.user.id) {
    res.status(403).render('error', { title: 'Acesso restrito', message: 'Você não tem permissão para ver este chamado.' });
    return null;
  }

  return ticket;
}

router.get('/tickets/:id', requireAuth, (req, res) => {
  const ticket = loadTicketOr403(req, res);
  if (!ticket) return;

  const comments = db.prepare(`
    SELECT comments.*, users.name as author_name, users.role as author_role
    FROM comments JOIN users ON comments.user_id = users.id
    WHERE ticket_id = ? ORDER BY comments.created_at ASC
  `).all(ticket.id);

  const attachments = db.prepare(`SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at DESC`).all(ticket.id);

  res.render('ticket-detail', {
    title: `Chamado #${ticket.id}`,
    ticket,
    comments,
    attachments,
    isStaff: isStaff(req.user)
  });
});

router.post('/tickets/:id/comments', requireAuth, (req, res) => {
  const ticket = loadTicketOr403(req, res);
  if (!ticket) return;

  const { body } = req.body;
  if (body && body.trim().length > 0) {
    db.prepare(`INSERT INTO comments (ticket_id, user_id, body) VALUES (?, ?, ?)`)
      .run(ticket.id, req.user.id, body.trim());
  }

  res.redirect(`/tickets/${ticket.id}`);
});

router.post('/tickets/:id/attachments', requireAuth, upload.single('file'), (req, res) => {
  const ticket = loadTicketOr403(req, res);
  if (!ticket) return;

  if (req.file) {
    db.prepare(`
      INSERT INTO attachments (ticket_id, stored_name, original_name, mime, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(ticket.id, req.file.filename, req.file.originalname, req.file.mimetype, req.user.id);
  }

  res.redirect(`/tickets/${ticket.id}`);
});

router.post('/tickets/:id/status', requireAuth, (req, res) => {
  const ticket = loadTicketOr403(req, res);
  if (!ticket) return;

  const { status } = req.body;
  const allowed = ['open', 'in_progress', 'closed'];
  if (allowed.includes(status)) {
    db.prepare(`UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, ticket.id);
  }
  res.redirect(`/tickets/${ticket.id}`);
});

// Exportação rápida do chamado em JSON para integrações externas (ex: planilhas, automações)
router.get('/tickets/:id/export', requireAuth, (req, res) => {
  const ticket = db.prepare(`
    SELECT tickets.*, users.name as owner_name, users.email as owner_email
    FROM tickets JOIN users ON tickets.user_id = users.id
    WHERE tickets.id = ?
  `).get(req.params.id);

  if (!ticket) return res.status(404).json({ error: 'not found' });

  const comments = db.prepare(`SELECT body, created_at FROM comments WHERE ticket_id = ?`).all(ticket.id);
  res.json({ ticket, comments });
});

module.exports = router;
