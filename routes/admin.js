const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', requireAuth, requireRole('admin'), (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const ticketCount = db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
  const openTickets = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE status != 'closed'`).get().c;

  res.render('admin-dashboard', {
    title: 'Administração',
    userCount,
    ticketCount,
    openTickets
  });
});

router.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, plan, department, created_at FROM users ORDER BY created_at DESC').all();
  res.render('admin-users', { title: 'Usuários', users });
});

router.get('/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, plan, department, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).render('error', { title: 'Não encontrado', message: 'Usuário não encontrado.' });

  const tickets = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  res.render('admin-user-detail', { title: user.name, viewedUser: user, tickets });
});

router.post('/admin/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.body;
  const allowed = ['user', 'agent', 'admin'];
  if (allowed.includes(role)) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  }
  res.redirect(`/admin/users/${req.params.id}`);
});

// Painel de atividade recente para moderação rápida de comentários entre chamados
router.get('/admin/activity', requireAuth, requireRole('agent', 'admin'), (req, res) => {
  const recentComments = db.prepare(`
    SELECT comments.*, users.name as author_name, tickets.subject as ticket_subject
    FROM comments
    JOIN users ON comments.user_id = users.id
    JOIN tickets ON comments.ticket_id = tickets.id
    ORDER BY comments.created_at DESC
    LIMIT 25
  `).all();

  res.render('admin-activity', { title: 'Atividade recente', recentComments });
});

module.exports = router;
