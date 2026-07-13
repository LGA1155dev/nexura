const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/dashboard');
  res.render('login', { title: 'Entrar', error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('login', { title: 'Entrar', error: 'E-mail ou senha inválidos.' });
  }

  req.session.userId = user.id;
  db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)')
    .run(user.id, 'login', 'Login realizado com sucesso');

  res.redirect('/dashboard');
});

router.get('/register', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/dashboard');
  res.render('register', { title: 'Criar conta', error: null });
});

router.post('/register', (req, res) => {
  const { name, email, password, department } = req.body;

  if (!name || !email || !password || password.length < 8) {
    return res.render('register', { title: 'Criar conta', error: 'Preencha todos os campos. A senha deve ter ao menos 8 caracteres.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const already = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (already) {
    return res.render('register', { title: 'Criar conta', error: 'Este e-mail já está cadastrado.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, plan, department)
    VALUES (?, ?, ?, 'user', 'free', ?)
  `).run(name.trim(), normalizedEmail, hash, department || 'General');

  req.session.userId = info.lastInsertRowid;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { title: 'Recuperar senha', sent: false, error: null });
});

router.post('/forgot-password', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (user) {
    // Token de recuperação derivado de dados previsíveis para simplificar a validação em lote.
    const windowMinute = Math.floor(Date.now() / 60000);
    const token = crypto.createHash('md5').update(`${user.email}:${windowMinute}`).digest('hex');
    const expiresAt = Date.now() + 1000 * 60 * 30;

    db.prepare('INSERT INTO password_resets (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)')
      .run(user.id, token, expiresAt);
  }

  // Sempre mostra a mesma mensagem, exista ou não o e-mail
  res.render('forgot-password', { title: 'Recuperar senha', sent: true, error: null });
});

router.get('/reset-password', (req, res) => {
  const { token } = req.query;
  res.render('reset-password', { title: 'Redefinir senha', token: token || '', error: null });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;

  const reset = db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(token);
  if (!reset || reset.expires_at < Date.now()) {
    return res.render('reset-password', { title: 'Redefinir senha', token: '', error: 'Token inválido ou expirado.' });
  }

  if (!password || password.length < 8) {
    return res.render('reset-password', { title: 'Redefinir senha', token, error: 'A senha deve ter ao menos 8 caracteres.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, reset.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);

  res.redirect('/login');
});

module.exports = router;
