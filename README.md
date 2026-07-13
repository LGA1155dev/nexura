# Nexura Desk

Sistema de help desk interno para abertura, acompanhamento e resolução de chamados de suporte técnico.

## Funcionalidades

- Autenticação de usuários e controle de acesso por papel (usuário, agente, administrador)
- Abertura e acompanhamento de chamados, com categorias, prioridades e status
- Comentários e anexos por chamado
- Painel administrativo com gestão de usuários
- Planos de conta e cupons de desconto

## Requisitos

- Node.js 18 ou superior
- npm

## Instalação

```bash
npm install
npm start
```

A aplicação sobe por padrão em `http://localhost:3000`.

## Estrutura

```
routes/       Rotas HTTP organizadas por domínio
middleware/   Autenticação e controle de acesso
views/        Templates EJS
public/       Arquivos estáticos (CSS, JS, uploads)
db/           Banco de dados SQLite, schema e seed inicial
```
