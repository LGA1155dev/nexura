const bcrypt = require('bcryptjs');
const { db } = require('./index');

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (existing.c === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, plan, department, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const adminEmail = 'renata.alves' + '@' + 'nexuradesk.internal';
  const agentEmail = 'diego.ferreira' + '@' + 'nexuradesk.internal';
  const u1Email = 'carla.mendes' + '@' + 'nexuradesk.internal';
  const u2Email = 'bruno.costa' + '@' + 'nexuradesk.internal';
  const u3Email = 'julia.santos' + '@' + 'nexuradesk.internal';

  const admin = insertUser.run('Renata Alves', adminEmail, hash('Cr7!mK9pQzXw2Lv'), 'admin', 'enterprise', 'IT Operations', '#0F6E63');
  const agent = insertUser.run('Diego Ferreira', agentEmail, hash('SupportAgent2024!'), 'agent', 'enterprise', 'Support', '#3D5A80');
  const u1 = insertUser.run('Carla Mendes', u1Email, hash('Carla@2024'), 'user', 'pro', 'Finance', '#B5860B');
  const u2 = insertUser.run('Bruno Costa', u2Email, hash('Bruno@2024'), 'user', 'free', 'Marketing', '#7A5195');
  const u3 = insertUser.run('Julia Santos', u3Email, hash('Julia@2024'), 'user', 'free', 'Sales', '#B3423A');

  const insertTicket = db.prepare(`
    INSERT INTO tickets (user_id, subject, description, category, priority, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const t1 = insertTicket.run(u1.lastInsertRowid, 'Não consigo acessar o relatório financeiro mensal',
    'Ao tentar abrir o relatório de fechamento, o sistema retorna erro de permissão. Preciso disso até amanhã para a reunião com a diretoria.',
    'access', 'high', 'open');

  const t2 = insertTicket.run(u2.lastInsertRowid, 'Notebook não conecta ao Wi-Fi corporativo',
    'Meu notebook (Dell Latitude) não reconhece a rede NEXURA-CORP desde a atualização de ontem.',
    'hardware', 'normal', 'in_progress');

  const t3 = insertTicket.run(u3.lastInsertRowid, 'Solicitação de licença adicional do CRM',
    'Preciso de mais 2 licenças do módulo de vendas para os novos contratados do time comercial.',
    'software', 'low', 'open');

  const t4 = insertTicket.run(u1.lastInsertRowid, 'Impressora do 4º andar sem toner',
    'A impressora HP do setor financeiro está sem toner há dois dias.',
    'hardware', 'low', 'closed');

  db.prepare(`INSERT INTO comments (ticket_id, user_id, body) VALUES (?, ?, ?)`)
    .run(t1.lastInsertRowid, agent.lastInsertRowid, 'Olá Carla, estamos verificando as permissões do seu usuário no módulo financeiro. Retorno em breve.');

  db.prepare(`INSERT INTO comments (ticket_id, user_id, body) VALUES (?, ?, ?)`)
    .run(t2.lastInsertRowid, u2.lastInsertRowid, 'Alguma novidade? Preciso do notebook funcionando para a reunião de amanhã.');

  console.log('Banco populado com dados iniciais.');
} else {
  console.log('Banco já possui dados. Seed ignorado.');
}
