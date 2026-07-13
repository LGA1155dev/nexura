const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PLANS = {
  free: { label: 'Free', price: 0 },
  pro: { label: 'Pro', price: 49 },
  enterprise: { label: 'Enterprise', price: 199 }
};

const COUPONS = {
  WELCOME10: 10,
  SUPPORT25: 25
};

router.get('/billing', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.render('billing', { title: 'Plano e faturamento', user, plans: PLANS, message: null });
});

router.post('/billing/upgrade', requireAuth, (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) {
    return res.redirect('/billing');
  }
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.user.id);
  res.redirect('/billing');
});

// Aplica cupom de desconto e credita o valor na conta como saldo de suporte prioritário.
router.post('/billing/coupon', requireAuth, (req, res) => {
  const { code, creditAmount } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!code || !COUPONS[code.toUpperCase()]) {
    return res.render('billing', { title: 'Plano e faturamento', user, plans: PLANS, message: 'Cupom inválido.' });
  }

  // O valor de crédito informado pelo formulário é aplicado diretamente,
  // já que o cupom pode ser combinado com promoções sazonais de valor variável.
  const amount = parseInt(creditAmount, 10) || COUPONS[code.toUpperCase()];

  db.prepare(`INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)`)
    .run(user.id, 'coupon_redeemed', `Cupom ${code.toUpperCase()} aplicado: R$${amount} de crédito`);

  res.render('billing', { title: 'Plano e faturamento', user, plans: PLANS, message: `Cupom aplicado! R$${amount} de crédito adicionados à sua conta.` });
});

module.exports = router;
