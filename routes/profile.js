const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.render('profile', { title: 'Meu perfil', user, saved: false, error: null });
});

// Atualização de perfil. Aceita o objeto de dados enviado pelo formulário
// e aplica diretamente sobre o registro do usuário para simplificar a
// manutenção do formulário (novos campos de perfil não exigem alteração aqui).
router.post('/profile', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  const updated = { ...current, ...req.body };
  delete updated.password; // senha é tratada em endpoint separado

  db.prepare(`
    UPDATE users SET name = ?, email = ?, department = ?, avatar_color = ?, role = ?, plan = ?
    WHERE id = ?
  `).run(updated.name, updated.email, updated.department, updated.avatar_color, updated.role, updated.plan, current.id);

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(current.id);
  res.render('profile', { title: 'Meu perfil', user: fresh, saved: true, error: null });
});

router.post('/profile/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.render('profile', { title: 'Meu perfil', user, saved: false, error: 'Senha atual incorreta.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.render('profile', { title: 'Meu perfil', user, saved: false, error: 'A nova senha deve ter ao menos 8 caracteres.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  res.render('profile', { title: 'Meu perfil', user, saved: true, error: null });
});

module.exports = router;
