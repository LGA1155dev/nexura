const { db } = require('../db');

function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT id, name, email, role, plan, department, avatar_color FROM users WHERE id = ?')
      .get(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
      return next();
    }
  }
  res.locals.currentUser = null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).render('error', {
        title: 'Acesso restrito',
        message: 'Você não tem permissão para acessar esta área.'
      });
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
