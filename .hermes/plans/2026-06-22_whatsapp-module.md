# WhatsApp Module + Tabs em Nova Aba — Plano de Implementação

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** (1) Tornar todas as abas do CRM abríveis em nova aba do navegador (clique direito / Ctrl+clique). (2) Criar módulo WhatsApp isolado (Module Pattern) visível apenas para master, que abre link do WhatsApp em nova aba. Número: +55 71 9205-7760.

**Architecture:** Duas mudanças no `index.html`: (a) substituir `onclick="mudarTab(...)"` nos links do sidebar por `<a href="#<tab>" data-tab="<tab>">` com listener delegado, permitindo clique direito → nova aba; adicionar detecção de `location.hash` no `DOMContentLoaded` para restaurar a aba correta. (b) Inserir módulo WhatsApp isolado (IIFE/Module Pattern) com botão `nav-master` no sidebar e handler que abre `https://wa.me/557192057760` em `window.open(..., '_blank')`.

**Tech Stack:** HTML + CSS + JS vanilla (SPA), Tailwind CDN.

---

## Phase 1 — Abas abríveis em nova aba do navegador

### Task 1: Trocar `onclick` por `href` nos links do sidebar

**Objective:** Substituir `onclick="mudarTab('...')"` por `<a href="#tab-..." data-tab="...">` para que clique direito / Ctrl+clique funcione.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — sidebar nav links (linhas ~697-720)

**Step 1: Substituir os 6 links do sidebar**

Mudar de:
```html
<a data-tab="dashboard" class="active" onclick="mudarTab('dashboard')">
```
Para:
```html
<a href="#tab-dashboard" data-tab="dashboard" class="active">
```

Fazer o mesmo para: `analises`, `andamento`, `emitidos`, `metricas`, `lixeira`.

A classe `nav-master` e `visible` nos links de métricas e lixeira permanecem iguais.

**Step 2: Adicionar listener delegado no sidebar**

No bloco de inicialização (após `DOMContentLoaded`), substituir a lógica de clique:

```javascript
// Delegação de clique no sidebar — permite clique direito / Ctrl+click para nova aba
document.getElementById('sidebar').addEventListener('click', function(e) {
  const link = e.target.closest('a[data-tab]');
  if (!link) return;
  e.preventDefault();
  const tab = link.getAttribute('data-tab');
  mudarTab(tab);
});
```

Este listener só dispara no clique esquerdo normal. Clique direito / Ctrl+clique abrem o `href` normalmente em nova aba.

**Step 3: Detectar hash na inicialização**

Após o login, verificar `location.hash`:

```javascript
// Após login bem-sucedido e renderização inicial:
function restaurarTabDoHash() {
  const hash = location.hash; // ex: "#tab-andamento"
  if (hash && hash.startsWith('#tab-')) {
    const tab = hash.replace('#tab-', '');
    mudarTab(tab);
  }
}
```

Chamar `restaurarTabDoHash()` dentro do fluxo pós-login, após as tabs estarem prontas.

**Step 4: Atualizar `mudarTab()` para sincronizar o hash na URL**

Adicionar no início da função `mudarTab()`:

```javascript
function mudarTab(tab) {
  // Sincroniza hash da URL (sem recarregar a página)
  if (location.hash !== '#tab-' + tab) {
    history.replaceState(null, '', '#tab-' + tab);
  }
  // ... resto do código existente
```

**Verificação:** Após implementar, testar:
1. Clique normal na aba → troca de aba normalmente
2. Ctrl+clique em "Em Andamento" → abre nova aba com `#tab-andamento` e mostra aba correta
3. Recarregar página com `#tab-lixeira` na URL → abre na Lixeira
4. Navegar entre abas → URL atualiza sem reload

---

### Task 2: Garantir que CSS `.tab-panel.active` funcione com hash

**Objective:** Conferir se o CSS existente `display: none` / `display: block` para `.tab-panel.active` já funciona. Se necessário, ajustar apenas seletor.

**Files:**
- Verify: `C:\Users\Prime04D\crm-uaicred\index.html` — CSS das `.tab-panel` (buscar por `.tab-panel`)

**Step 1: Inspecionar CSS atual**

Buscar por `.tab-panel` no arquivo para confirmar que:
```css
.tab-panel { display: none; }
.tab-panel.active { display: block; }
```

**Step 2: Se ausente, adicionar**

Se não existir, adicionar no `<style>` existente.

**Verificação:** Abrir DevTools, checar que painéis ocultos têm `display: none` e o ativo tem `display: block`.

---

## Phase 2 — Módulo WhatsApp (isolado, apenas master)

### Task 3: Adicionar link do WhatsApp no sidebar (nav-master)

**Objective:** Botão "WHATSAPP" no sidebar, visível apenas para master, que abre link do WhatsApp em nova aba.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — sidebar nav (após Lixeira)

**Step 1: Inserir o link no sidebar**

Após o link da Lixeira (linha ~720), adicionar:

```html
<a href="#" data-tab="whatsapp" class="nav-master" id="nav-whatsapp">
  <span class="nav-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  </span>
  <span class="nav-text">WHATSAPP</span>
</a>
```

A classe `nav-master` já garante que só aparece para master (via CSS existente `.nav-master.visible { display: flex; }` e JS que adiciona `.visible` aos elementos `.nav-master` no login do master).

**Verificação:** Login como master → botão WHATSAPP aparece no sidebar. Login como user → não aparece.

---

### Task 4: Criar módulo WhatsApp isolado (Module Pattern)

**Objective:** Inserir bloco de código IIFE que gerencia toda a lógica do WhatsApp, com escopo fechado, sem poluir o namespace global.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — após o fim do script principal, antes de `</body>`

**Step 1: Inserir o módulo WhatsApp**

```javascript
// ==================== MÓDULO WHATSAPP (ISOLADO) ====================
const WhatsAppModule = (function() {
  // ---- configuração ----
  const WHATSAPP_NUMERO = '557192057760'; // +55 71 9205-7760
  const WHATSAPP_LINK   = 'https://wa.me/' + WHATSAPP_NUMERO;

  // ---- estado interno ----
  let inicializado = false;
  let analista = null;

  // ---- handlers ----
  function aoClicarWhatsApp(e) {
    // Só abre em nova aba — não interfere na navegação normal do CRM
    e.preventDefault();
    window.open(WHATSAPP_LINK, '_blank', 'noopener,noreferrer');
  }

  function aoClicarCliente(numero) {
    // Futuro: abrir chat específico com ?text=...
    const url = 'https://wa.me/55' + numero.replace(/\D/g, '');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ---- init ----
  function iniciar() {
    if (inicializado) return;

    const btn = document.getElementById('nav-whatsapp');
    if (btn) {
      btn.addEventListener('click', aoClicarWhatsApp);
    }

    inicializado = true;
    console.log('[WhatsApp] Módulo iniciado. Número:', WHATSAPP_NUMERO);
  }

  // Escuta evento de profile-ready pra saber se é master
  window.addEventListener('profile-ready', function(e) {
    if (e.detail && e.detail.tipo === 'master') {
      analista = e.detail.nome;
      iniciar();
    }
  });

  // ---- API pública ----
  return {
    getNumero: function() { return WHATSAPP_NUMERO; },
    abrirChat: aoClicarCliente,
    debug: function() {
      return {
        inicializado: inicializado,
        numero: WHATSAPP_NUMERO,
        analista: analista,
        botaoExiste: !!document.getElementById('nav-whatsapp')
      };
    }
  };
})();
// ==================== FIM MÓDULO WHATSAPP ====================
```

**Step 2: Garantir que o módulo não quebra se o DOM não estiver pronto**

O listener `profile-ready` já garante que o DOM está montado (o evento dispara após `initProfile()` que roda após `DOMContentLoaded`). O módulo é seguro — se `nav-whatsapp` não existir no DOM, simplesmente não faz nada.

**Verificação:**
1. Login como master → console mostra `[WhatsApp] Módulo iniciado. Número: 557192057760`
2. Clicar no botão WHATSAPP → abre `https://wa.me/557192057760` em nova aba
3. Login como user → botão não aparece, módulo não inicia
4. `WhatsAppModule.debug()` no console → retorna estado correto
5. Erro dentro do módulo não afeta o resto do CRM

---

### Task 5: Integrar módulo ao `mudarTab()` (sem conflito)

**Objective:** Quando o link WHATSAPP for clicado com clique normal, o listener delegado do sidebar vai interceptar e chamar `mudarTab('whatsapp')`. Como não existe painel `#tab-whatsapp`, precisamos tratar esse caso.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — função `mudarTab()`

**Step 1: Adicionar tratamento para tab 'whatsapp'**

No início de `mudarTab()`, antes da lógica de painéis:

```javascript
function mudarTab(tab) {
  // WhatsApp abre em nova aba — não tem painel interno
  if (tab === 'whatsapp') {
    window.open('https://wa.me/557192057760', '_blank', 'noopener,noreferrer');
    return; // não altera tabAtivo, não mexe nos painéis
  }

  // Sincroniza hash da URL
  if (location.hash !== '#tab-' + tab) {
    history.replaceState(null, '', '#tab-' + tab);
  }

  // ... resto do código existente ...
}
```

**Verificação:**
1. Login master, clicar WHATSAPP → abre WhatsApp Web em nova aba, CRM permanece na aba atual
2. Ctrl+click no WHATSAPP → abre em nova aba (comportamento nativo do `<a href="#">`)
3. Nenhum erro no console

---

## Resumo de mudanças no index.html

| Linhas | Mudança |
|---|---|
| ~697-720 | 6 links do sidebar: `onclick="mudarTab(...)"` → `href="#tab-..." data-tab="..."` |
| ~721 | +1 link WHATSAPP com classe `nav-master` |
| ~1167 | `mudarTab()`: adicionar `history.replaceState` + tratamento `whatsapp` |
| ~1244 | Bloco pós-login: adicionar listener delegado no sidebar + `restaurarTabDoHash()` |
| ~3500 | +1 bloco WhatsAppModule (~70 linhas) antes de `</body>` |

**Total estimado:** ~30 linhas modificadas, ~90 linhas novas.

---

## Riscos

- **Conflito de listener:** O listener delegado no sidebar (`e.preventDefault()`) pode interferir com outros handlers se existirem. Como atualmente os links usam `onclick` inline, remover o `onclick` e usar só o listener delegado resolve.
- **Hash quebrado em deploy existente:** Se a Vercel servir o HTML sem processamento de hash, não há problema — o hash é client-side, 100% navegador.
- **Módulo WhatsApp vs nome global:** O nome `WhatsAppModule` é exposto como variável global (para debug), mas todo o estado interno é privado. Se algum dia houver colisão de nome, trocar para `__whatsapp`.

---

## Verificação final

Após todas as tasks:

1. Login master → sidebar mostra 7 abas (Dash, Análises, Em Andamento, Emitidos, Métricas, Lixeira, WhatsApp)
2. Login user → sidebar mostra 4 abas (Dash, Análises, Em Andamento, Emitidos)
3. Ctrl+clique em qualquer aba → abre em nova aba com hash correto
4. Recarregar aba com `#tab-lixeira` → abre na Lixeira
5. Clicar WHATSAPP → abre `wa.me/557192057760` em nova aba, CRM intacto
6. `WhatsAppModule.debug()` no console → `{ inicializado: true, numero: "557192057760", ... }`
7. Dashboard, tabelas, pipeline, Excel — tudo funcionando normalmente
