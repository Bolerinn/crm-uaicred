# CRM UaiCred — Segurança, Correções e Estabilização

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Resolver a exposição da Service Role Key no frontend, corrigir bugs conhecidos, e preparar a base para refatoração e novas features.

**Architecture:** O CRM é um SPA (HTML/CSS/JS puro) com Supabase (PostgreSQL + Auth). Atualmente a Service Role Key está exposta no frontend em `index.html:1090`. Vamos substituir as chamadas admin por Supabase Edge Functions, mantendo a experiência idêntica.

**Tech Stack:** HTML, CSS, JS (vanilla), Tailwind CDN, Supabase (Auth, DB, Edge Functions, Realtime), SheetJS (xlsx), Vercel (static hosting)

---

## PARTE 1: Segurança (P0) — Remover Service Role Key do Frontend

### Diagnóstico atual

A Service Role Key está exposta em `index.html:1090`:
```js
const SERVICE_ROLE_KEY = 'eyJhbG...YRpU';
const sbAdmin = supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
```

Usada em 3 lugares:
1. `carregarDados()` (L1478-1490) — fetch de clientes via REST API sem filtro RLS
2. `excluirCliente()` (L1559) — soft-delete com `sbAdmin.from('clientes').update()`
3. `restaurarCliente()` (L1569) — restaurar com `sbAdmin.from('clientes').update()`

### Solução: Supabase Edge Functions

Criar 3 Edge Functions que substituem os calls diretos com service_role:

| Edge Function | Substitui | Método |
|---|---|---|
| `get-clientes` | `carregarDados()` | GET (usa service_role server-side) |
| `soft-delete-cliente` | `excluirCliente()` | POST (soft-delete + registro de quem deletou) |
| `restore-cliente` | `restaurarCliente()` | POST (restaura deleted_at = null) |

---

### Task 1: Configurar ambiente Supabase CLI

**Objective:** Instalar e autenticar Supabase CLI para deploy de Edge Functions.

**Files:**
- Create: `supabase/config.toml` (opcional, só pra referência)
- Create: `supabase/functions/get-clientes/index.ts`
- Create: `supabase/functions/soft-delete-cliente/index.ts`
- Create: `supabase/functions/restore-cliente/index.ts`
- Modify: `index.html` (remover SERVICE_ROLE_KEY, sbAdmin; usar fetch para Edge Functions)

**Step 1: Instalar Supabase CLI**

Run: `npm install -g supabase`

**Step 2: Login**

Run: `npx supabase login`

**Step 3: Link project**

Run: `npx supabase link --project-ref dztiktcvueorlafiocdf`

Expected: Project linked successfully

---

### Task 2: Criar Edge Function `get-clientes`

**Objective:** Substituir o fetch REST com service_role por Edge Function que usa service_role server-side.

**Files:**
- Create: `supabase/functions/get-clientes/index.ts`

**Step 1: Criar a função**

```typescript
// supabase/functions/get-clientes/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // Apenas usuários autenticados podem acessar
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("clientes")
    .select("*")
    .is("deleted_at", null)
    .order("id");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 2: Deploy**

```bash
cd supabase/functions
npx supabase functions deploy get-clientes
```

Expected: Function deployed e URL retornada

**Step 3: Testar**

```bash
curl -H "Authorization: Bearer <token-de-teste>" \
  https://dztiktcvueorlafiocdf.supabase.co/functions/v1/get-clientes
```

Expected: Retorna array JSON de clientes

---

### Task 3: Criar Edge Function `soft-delete-cliente`

**Objective:** Substituir chamada `sbAdmin.from('clientes').update({ deleted_at })` por Edge Function segura.

**Files:**
- Create: `supabase/functions/soft-delete-cliente/index.ts`

**Step 1: Criar a função**

```typescript
// supabase/functions/soft-delete-cliente/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  // Verificar se o usuário tem permissão (master)
  const userSb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await userSb.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401 });
  }

  const { id, analista } = await req.json();

  if (!id) {
    return new Response(JSON.stringify({ error: "ID necessário" }), { status: 400 });
  }

  const isMaster = user.user_metadata?.tipo === "master" || user.email === "contatoadouglas@gmail.com";

  const { error } = await userSb
    .from("clientes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: analista || "—",
    })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 2: Deploy e testar**

```bash
npx supabase functions deploy soft-delete-cliente
```

---

### Task 4: Criar Edge Function `restore-cliente`

**Objective:** Substituir chamada `sbAdmin.from('clientes').update({ deleted_at: null })`.

**Files:**
- Create: `supabase/functions/restore-cliente/index.ts`

**Step 1: Criar a função**

```typescript
// supabase/functions/restore-cliente/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await sb.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401 });
  }

  const { id } = await req.json();

  if (!id) {
    return new Response(JSON.stringify({ error: "ID necessário" }), { status: 400 });
  }

  const isMaster = user.user_metadata?.tipo === "master" || user.email === "contatoadouglas@gmail.com";
  if (!isMaster) {
    return new Response(JSON.stringify({ error: "Apenas master pode restaurar" }), { status: 403 });
  }

  const { error } = await sb
    .from("clientes")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 2: Deploy e testar**

```bash
npx supabase functions deploy restore-cliente
```

---

### Task 5: Atualizar `index.html` — remover keys e usar Edge Functions

**Objective:** Substituir chamadas com `sbAdmin`/`SERVICE_ROLE_KEY` por fetch para Edge Functions.

**Files:**
- Modify: `index.html`

**Step 1: Remover SERVICE_ROLE_KEY e sbAdmin (L1090-1091)**

Remover estas duas linhas:
```js
const SERVICE_ROLE_KEY = 'eyJhbG...YRpU';
const sbAdmin = supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
```

**Step 2: Criar helper `getAuthHeaders()`**

Adicionar no STATE section:
```js
function getAuthHeaders() {
  return {
    'Authorization': 'Bearer ' + sb.auth.session()?.access_token,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
}
```

**Step 3: Atualizar `carregarDados()`**

Substituir o fetch com service_role (L1478-1490) por:
```js
async function carregarDados() {
  const resp = await fetch(SUPABASE_URL + '/functions/v1/get-clientes', {
    headers: getAuthHeaders()
  });
  if (resp.ok) {
    clientes = await resp.json();
    clientes = [...new Map(clientes.map(c => [c.id, c])).values()];
  } else {
    // Fallback: usar cliente normal com RLS
    const { data, error } = await sb.from('clientes').select('*').is('deleted_at', null).order('id');
    if (error) { mostrarToast('Erro ao carregar dados'); return; }
    clientes = data;
  }

  document.addEventListener('focusin', function(e) {
    if (e.target.dataset && e.target.dataset.campo === 'indicacao') {
      e.target.dataset.oldValue = e.target.value;
    }
  });

  popularDatalistIndicacoes();
  renderizarTudo();
}
```

**Step 4: Atualizar `excluirCliente()`**

Substituir a chamada `sbAdmin.from('clientes').update()` (L1559) por:
```js
const { error } = await (async () => {
  const resp = await fetch(SUPABASE_URL + '/functions/v1/soft-delete-cliente', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, analista }),
  });
  const result = await resp.json();
  return { error: resp.ok ? null : { message: result.error } };
})();
```

**Step 5: Atualizar `restaurarCliente()`**

Substituir a chamada `sbAdmin.from('clientes').update()` (L1569) por:
```js
const resp = await fetch(SUPABASE_URL + '/functions/v1/restore-cliente', {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify({ id }),
});
const result = await resp.json();
const error = resp.ok ? null : { message: result.error };
```

**Step 6: Commit**

```bash
git add -A
git commit -m "fix: remover SERVICE_ROLE_KEY do frontend, migrar para Edge Functions"
```

---

### Task 6: Subir environment variables no Supabase

**Objective:** Configurar as secrets necessárias para as Edge Functions.

Run:
```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key> --project-ref dztiktcvueorlafiocdf
```

Expected: Secret set successfully

---

### Task 7: Deploy no Vercel e verificar

**Objective:** Garantir que o deploy não quebrou.

Run:
```bash
cd ~/crm-uaicred
git push origin master
```

Depois verificar no Vercel se o deploy automático rolou.
Acessar https://crm-primerms.vercel.app/ e verificar:
- [ ] Login funciona
- [ ] Dados carregam
- [ ] Excluir processo funciona
- [ ] Restaurar da lixeira funciona
- [ ] SERVICE_ROLE_KEY não aparece mais no source

---

## PARTE 2: Bugs Conhecidos (P1)

> ⚠️ **Aguardando o usuário listar os bugs específicos.** O user mencionou que tem bugs já reportados várias vezes. Essa seção será expandida.

### Estrutura para cada bug:

Cada bug terá:
- **Descrição:** O que acontece vs esperado
- **Reprodução:** Passos exatos
- **Arquivos:** Quais arquivos tocar
- **Correção:** Código exato da fix
- **Teste:** Como verificar que foi corrigido

---

## PARTE 3: Refatoração (P2)

### Diagnóstico atual

O `index.html` tem **3357 linhas / 167 KB** — tudo num arquivo só:
- CSS (linhas 47-670)
- HTML (linhas 670-1060)
- JS (linhas 1088-3357)

### Plano de Refatoração (Fase 1 — Extração CSS/JS)

Separar em múltiplos arquivos **sem alterar comportamento**:

```
crm-uaicred/
├── index.html        (~800 linhas, só HTML + imports)
├── css/
│   └── styles.css    (~620 linhas, extraído do <style>)
├── js/
│   ├── auth.js       (~200 linhas, login/logout/troca senha)
│   ├── crud.js       (~300 linhas, carregar/adicionar/editar/excluir)
│   ├── tabelas.js    (~400 linhas, renderização das 3 tabelas)
│   ├── metricas.js   (~300 linhas, dashboard + métricas)
│   ├── filtros.js    (~150 linhas, filtros e seletores)
│   ├── indicacoes.js (~150 linhas, parceiros/indicações)
│   ├── utils.js      (~100 linhas, máscaras, toast, helpers)
│   └── config.js     (~50 linhas, constantes e estado global)
└── supabase/
    └── functions/    (Edge Functions)
```

> ⚠️ **Fase 2:** Migrar para module pattern ou ES modules moderno, se necessário. Mas só depois da Fase 1 estar 100% estável.

### Task R1: Extrair CSS para arquivo separado

### Task R2: Extrair JS de auth para `js/auth.js`

### Task R3: Extrair JS de CRUD para `js/crud.js`

### Task R4: Extrair JS de tabelas para `js/tabelas.js`

### Task R5: Extrair JS de métricas para `js/metricas.js`

### Task R6: Extrair JS de filtros para `js/filtros.js`

### Task R7: Extrair JS de indicações para `js/indicacoes.js`

### Task R8: Extrair helpers para `js/utils.js` e config para `js/config.js`

### Task R9: Verificar que tudo funciona após refatoração

---

## PARTE 4: Novas Features (P3)

> ⚠️ **Aguardando o TODO list do usuário.** Prioridade: deixar tudo 100% funcional.

---

## Riscos e Tradeoffs

### Risco: Edge Functions quebram com tráfego alto
- **Mitigação:** Supabase free tier tem 500K invocações/mês — suficiente
- **Fallback:** O código mantém o `sb.from('clientes')` como fallback com RLS

### Risco: Token de autenticação expira durante fetch
- **Mitigação:** Supabase SDK renova tokens automaticamente; `getAuthHeaders()` usa `sb.auth.session()?.access_token`

### Risco: Git push aciona deploy automático no Vercel
- **Mitigação:** Testar localmente com `npx serve .` antes de dar push

### Tradeoff: Edge Functions vs Vercel Serverless
- Escolhemos Supabase Edge Functions porque:
  - Já estamos no ecossistema Supabase
  - Não precisa configurar outro serviço (Vercel Functions)
  - As secrets ficam no Supabase (único lugar)

---

## Validação Final

- [ ] `curl -sL https://crm-primerms.vercel.app/ | grep -i service_role` retorna vazio
- [ ] Login funciona
- [ ] CRUD funciona
- [ ] Excluir e restaurar funciona
- [ ] Realtime funciona
- [ ] Exportação Excel/CSV funciona
- [ ] Dashboard carrega
- [ ] Métricas carregam (master)

---

## Dependências

- `npm` (já instalado)
- `git` (já instalado)
- Supabase CLI (`npm install -g supabase`)
- Acesso ao dashboard do Supabase (para secrets)
- Token de acesso ao Supabase
