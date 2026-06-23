# Correções CRM — Modal Imobiliária + Z-Index + Métricas Double-Check

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Corrigir 4 bugs: campo Imobiliária não aparece ao abrir modal com Corretor pré-selecionado, editar parceiro sem campo Imobiliária, popup de edição atrás da lista, e funções de métricas com dados incorretos.

**Architecture:** SPA monolítico em `index.html`, lógica de parceiros em `js/indicacoes.js`, localStorage para parceiros, templates inline para métricas.

**Tech Stack:** HTML/CSS/JS vanilla, Tailwind CDN, Supabase REST, localStorage

---

## Task 1: Campo Imobiliária visível ao abrir modal com Corretor padrão

**Objective:** Quando o modal "Nova Indicação" abre, Corretor já vem selecionado (primeira option), mas o campo Imobiliária não aparece porque o listener `change` só dispara com interação do usuário.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\js\indicacoes.js` — função `abrirModalIndicacao()` (linha 153)

### Step 1: Disparar evento change ao abrir modal

Em `abrirModalIndicacao()` (indicacoes.js ~linha 153-156):

**De:**
```javascript
function abrirModalIndicacao() {
  document.getElementById('modalIndicacao').classList.remove('hidden');
  document.getElementById('indNome').focus();
}
```

**Para:**
```javascript
function abrirModalIndicacao() {
  document.getElementById('modalIndicacao').classList.remove('hidden');
  document.getElementById('indNome').focus();
  // Disparar evento change para mostrar/esconder imobiliária baseado no tipo padrão
  document.getElementById('indTipo').dispatchEvent(new Event('change'));
}
```

### Step 2: Commit

```bash
git add js/indicacoes.js
git commit -m "fix: campo imobiliaria visivel ao abrir modal com Corretor default"
```

---

## Task 2: Campo Imobiliária no modal de Editar Parceiro

**Objective:** O modal "Editar Parceiro" precisa ter o campo Imobiliária (condicional, igual ao modal de adição) e as funções `editarParceiro` e `salvarEdicaoParceiro` devem lidar com ele.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — modal HTML `#modalEditarParceiro` (linhas 930-954)
- Modify: `C:\Users\Prime04D\crm-uaicred\js\indicacoes.js` — funções `editarParceiro` (linha 85), `salvarEdicaoParceiro` (linha 96), `fecharModalEditarParceiro` (linha 92)

### Step 1: Adicionar campo Imobiliária no HTML do modal de edição

No `#modalEditarParceiro` (index.html linha 947-950), após o campo Nome e antes do `<p>` de aviso:

```html
<div class="mb-3 hidden" id="editImobiliariaGroup">
  <label class="text-xs mb-1 block" style="color:var(--text-muted);">Imobiliária</label>
  <input type="text" id="editImobiliaria" placeholder="Nome da imobiliária (opcional)" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:var(--border);background:var(--bg-input);color:var(--text);">
</div>
```

### Step 2: Listener change no select de tipo do modal de edição

No `<script>` do index.html, adicionar listener para `editParceiroTipo`:

```javascript
document.getElementById('editParceiroTipo').addEventListener('change', function() {
  const grupo = document.getElementById('editImobiliariaGroup');
  grupo.classList.toggle('hidden', this.value !== 'Corretor');
  if (this.value !== 'Corretor') document.getElementById('editImobiliaria').value = '';
});
```

### Step 3: Atualizar função editarParceiro

Em indicacoes.js, `editarParceiro(nome, tipo)` (linha 85-90):

**De:**
```javascript
function editarParceiro(nome, tipo) {
  document.getElementById('editParceiroNomeOriginal').value = nome;
  document.getElementById('editParceiroNome').value = nome;
  document.getElementById('editParceiroTipo').value = tipo || 'Outro';
  document.getElementById('modalEditarParceiro').classList.remove('hidden');
}
```

**Para:**
```javascript
function editarParceiro(nome, tipo) {
  document.getElementById('editParceiroNomeOriginal').value = nome;
  document.getElementById('editParceiroNome').value = nome;
  document.getElementById('editParceiroTipo').value = tipo || 'Outro';
  // Carregar imobiliária do parceiro
  const lista = carregarIndicacoes();
  const parceiro = lista.find(i => i.nome === nome);
  const imobiliaria = parceiro?.imobiliaria || '';
  document.getElementById('editImobiliaria').value = imobiliaria;
  // Mostrar/esconder campo
  document.getElementById('editParceiroTipo').dispatchEvent(new Event('change'));
  document.getElementById('modalEditarParceiro').classList.remove('hidden');
}
```

### Step 4: Atualizar função salvarEdicaoParceiro

Em indicacoes.js, `salvarEdicaoParceiro()` (linha 96-132), no bloco onde atualiza o parceiro:

Após `lista[idx].tipo = novoTipo;` (linha 119), adicionar:
```javascript
const novaImobiliaria = (document.getElementById('editImobiliaria')?.value || '').trim();
lista[idx].imobiliaria = novaImobiliaria;
```

E no bloco do `if (novoNome !== nomeOriginal)` (linha 116-123), também adicionar a imobiliária nos aliases:
```javascript
if (novoNome !== nomeOriginal) {
  lista[idx].nome = novoNome;
  lista[idx].tipo = novoTipo;
  lista[idx].imobiliaria = novaImobiliaria;
  if (emUso > 0 && !lista.some(i => i.nome === nomeOriginal)) {
    lista.push({ nome: nomeOriginal, tipo: novoTipo, imobiliaria: novaImobiliaria, adicionado_em: new Date().toISOString(), _legado: true });
  }
}
```

### Step 5: Atualizar fecharModalEditarParceiro

```javascript
function fecharModalEditarParceiro() {
  document.getElementById('modalEditarParceiro').classList.add('hidden');
  document.getElementById('editImobiliaria').value = '';
  document.getElementById('editImobiliariaGroup').classList.add('hidden');
}
```

### Step 6: Commit

```bash
git add index.html js/indicacoes.js
git commit -m "feat: campo imobiliaria no modal de editar parceiro"
```

---

## Task 3: Corrigir z-index do popup de edição

**Objective:** O modal de editar parceiro abre atrás da lista de parceiros porque ambos têm `z-index: 100`. Aumentar o z-index do modal de edição.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — elemento `#modalEditarParceiro` (linha 930)

### Step 1: Adicionar z-index inline

No `<div id="modalEditarParceiro" class="modal-overlay hidden" ...>` (linha 930):

**De:**
```html
<div id="modalEditarParceiro" class="modal-overlay hidden" onclick="if(event.target===this)fecharModalEditarParceiro()">
```

**Para:**
```html
<div id="modalEditarParceiro" class="modal-overlay hidden" style="z-index:110;" onclick="if(event.target===this)fecharModalEditarParceiro()">
```

### Step 2: Commit

```bash
git add index.html
git commit -m "fix: z-index do modal editar parceiro sobre a lista"
```

---

## Task 4: Double-check e correção das funções de métricas

**Objective:** Verificar e corrigir funções da aba Métricas: a seção Caixa vs Privados usa apenas `c.banco` (texto) e ignora campos booleanos; datas no filtro personalizado não têm máscara.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — função `renderizarMetricas()` (linhas 2824-3095), filtros (linhas 2956-2960)

### Step 2 (Métricas): Corrigir Caixa vs Privados para usar booleanos

Na função `renderizarMetricas()`, linhas 2850-2854:

**De:**
```javascript
const caixa = filtrados.filter(c => (c.banco||'').toLowerCase() === 'caixa');
const privados = filtrados.filter(c => {
    const b = (c.banco||'').toLowerCase();
    return ['bradesco','itaú','itau','santander','inter'].includes(b);
});
```

**Para:**
```javascript
const caixa = filtrados.filter(c => 
  (c.banco||'').toLowerCase() === 'caixa' || c.banco_caixa === true
);
const privados = filtrados.filter(c => {
  const b = (c.banco||'').toLowerCase();
  return ['bradesco','itaú','itau','santander','inter'].includes(b) ||
    c.banco_bradesco === true || c.banco_itau === true || 
    c.banco_santander === true || c.banco_inter === true;
});
```

### Step 3 (Métricas): Adicionar mascaraData nos inputs de data

No template de métricas, substituir `onchange` por `oninput` com máscara + `onchange`:

Para os inputs de data no filtro personalizado (linhas 2957 e 2959):

**De:**
```html
onchange="metricaDataInicio=this.value;renderizarMetricas()"
```

**Para:**
```html
oninput="mascaraData(this)" onchange="metricaDataInicio=this.value;renderizarMetricas()"
```

Aplicar o mesmo nos 2 inputs (`metricaDataInicio` e `metricaDataFim`).

### Step 4 (Métricas): Verificar parseDataBR para datas de 2 dígitos

A função `parseDataBR` (linha 2204) espera `dd/mm/aaaa`. Se o usuário digitar `dd/mm/aa` (ano com 2 dígitos), `parts[2]` seria `"aa"` com 2 dígitos. `parseInt("aa")` funciona mas interpreta errado.

Adicionar validação de ano mínimo:

```javascript
function parseDataBR(str) {
  if (!str || str === '—') return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, a = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(a)) return null;
  if (a < 100) a += 2000; // ano com 2 dígitos
  return new Date(a, m, d);
}
```

### Step 5 (Métricas): Verificar filtro 12-meses

Função `metricaFiltrarPorPeriodo` linha 2785-2787:
```javascript
if (metricaPeriodo === '12-meses') {
    const limite = `${ano-1}-${String(mes+1).padStart(2,'0')}`;
    return lista.filter(c => (c.mes_referencia || '') >= limite);
}
```

O `mes_referencia` é formato `YYYY-MM`. Comparação de strings funciona corretamente para este formato. ✅ OK.

### Step 6: Commit

```bash
git add index.html
git commit -m "fix: Caixa vs Privados booleanos + mascara data métricas + parseDataBR ano 2 digitos"
```

---

## Task 5: Push + Deploy

```bash
git push
npx vercel --prod --token VERCEL_TOKEN --yes
```

**IMPORTANTE:** Usar `VERCEL_TOKEN` como placeholder no plano, substituir pelo token real apenas no terminal.

---

## Verificação final

| # | Verificação |
|---|-------------|
| 1 | Abrir "+ Novo Parceiro" → campo Imobiliária visível (Corretor padrão) |
| 2 | "Ver Parceiros" → Editar um Corretor → campo Imobiliária aparece preenchido |
| 3 | "Ver Parceiros" → Editar → popup de edição fica NA FRENTE da lista |
| 4 | Métricas → Período personalizado → datas aceitam `dd/mm/aaaa` com máscara |
| 4b | Métricas → Caixa vs Privados → números corretos considerando campos booleanos |
