# CRM UaiCred

Sistema de CRM para Correspondente Caixa Aqui — financiamento de imóveis em Salvador, BA.

## 🚀 Setup Rápido

### 1. Crie o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (grátis)
2. Crie um **novo projeto** (nome: `crm-uaicred`)
3. Vá em **SQL Editor**, cole o conteúdo de `supabase-schema.sql` e execute
4. Vá em **Authentication → Users → Add User** e crie os 4 usuários (e-mail + senha)

### 2. Configure o Frontend

1. No arquivo `index.html`, edite no topo do `<script>`:
```js
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON';
```
2. Pegue a URL e a chave anônima em **Supabase → Settings → API**

### 3. Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique **Add New → Project**
3. Importe o repositório ou faça upload da pasta `crm-uaicred/`
4. **Deploy** — pronto! 🎉

## 📋 Funcionalidades

- Login com e-mail e senha
- 11 campos por cliente
- Filtros por Status e Produto
- Tempo real (alterações aparecem pra todos)
- Exportar CSV e Excel
- 4 usuários simultâneos
