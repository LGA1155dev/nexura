const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

require('./db'); // garante que schema esteja criado
try {
  require('./db/seed');
} catch (e) {
  // seed é opcional em execuções subsequentes
}

const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const billingRoutes = require('./routes/billing');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'db') }),
  secret: 'nexura-desk-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(attachUser);

app.use('/', authRoutes);
app.use('/', ticketRoutes);
app.use('/', profileRoutes);
app.use('/', adminRoutes);
app.use('/', billingRoutes);

app.get('/', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/dashboard');
  res.redirect('/login');
});

app.use((req, res) => {
  res.status(404).render('error', { title: 'Página não encontrada', message: 'O recurso solicitado não existe.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Erro interno', message: err.message, stack: err.stack });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Nexura Desk rodando em http://localhost:${PORT}`);
});
