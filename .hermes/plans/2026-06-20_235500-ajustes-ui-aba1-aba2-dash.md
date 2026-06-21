# Correções e Ajustes — Aba 1, Aba 2, Dash

> **For Hermes:** Execute directly, um patch por vez, commit + deploy a cada fix.

**Goal:** Corrigir 8 ajustes visuais e de comportamento no CRM.

**Arquivo único:** `C:\Users\Prime04D\crm-uaicred\index.html` — todas as mudanças são nesse arquivo.

---

## Fix 1: Coluna "Criado por" só visível pro master — ok, mas sem parecer separada

**Diagnóstico:** A coluna `criado-por-col` tem `display:none` e só aparece com `body.master .criado-por-col { display: table-cell !important; }`. Quando visível, o espaçamento parece "separado" da linha.

**Arquivo:** `index.html` — CSS inline e HTML da tabela

**Ação:** 
- Adicionar `border-left: 1px dashed var(--border)` na `.criado-por-col` pra dar continuidade visual na linha
- Garantir que o hover da linha cubra essa coluna também (`tr:hover .criado-por-col { background: var(--row-hover); }`)

---

## Fix 2: Cabeçalhos "Follow-up" → "F-U" e "Convertido" → "Conv."

**Arquivo:** `index.html` — HTML do `<thead>` da tabela de Análises (linha ~770)

**Ação:** Trocar os textos:
- `<th>Follow-up</th>` → `<th title="Follow-up">F-U</th>`
- `<th>Convertido</th>` → `<th title="Convertido">Conv.</th>`

---

## Fix 3: Cliente convertido — clonar pra Aba 2 + permanecer na Aba 1 + evitar clones

**Diagnóstico:** `converterCliente()` atualiza `convertido=true` no registro atual, mas o registro sai da Aba 1 (porque o filtro `getFiltrados` exclui `convertido === true` da Aba 1).

**Comportamento desejado:**
- Ao marcar convertido: **clonar** o registro (criar uma cópia) com `mes_referencia` atual e `convertido=true` para aparecer na Aba 2
- O registro original **permanece na Aba 1** com `convertido=true` (check marcado) mas sem sumir
- O filtro da Aba 1 (`getFiltrados`) NÃO deve excluir registros com `convertido === true` — ou então usa outro campo (`convertido_em` ou `clonado_para_aba2`) pra controle
- Ao desmarcar: não apagar o clone da Aba 2 (já foi criado)
- Se marcar de novo: verificar se já existe clone na Aba 2 com mesmo `cliente` no mesmo `mes_referencia`. Se existir, não criar outro

**Arquivo:** `index.html` — função `converterCliente()` e `getFiltrados()`

**Ação:**
1. No `getFiltrados` para Aba 1: REMOVER a condição `c.convertido !== true` — a Aba 1 mostra todos os registros do mês, convertidos ou não
2. Em `converterCliente()`: ao marcar, chamar `adicionarCliente()` ou `duplicarCliente()` com os dados do cliente + `mes_referencia` atual + `convertido=true` + `status='aguardando-doc'` (estado inicial da Aba 2). **Antes de duplicar**, verificar se já existe na Aba 2 um registro com mesmo `cliente` e mesmo `mes_referencia`.
3. A verificação anti-clone: `const jaExiste = clientes.some(c => c.cliente === nomeCliente && c.mes_referencia === mesRef && c.convertido === true);` — se já existe, só atualiza status; se não, cria clone.

---

## Fix 4: Valor Imóvel e Valor Financiado somem ao trocar de aba

**Diagnóstico:** Os inputs usam `oninput="this.value=this.value.replace(/[^\\d]/g,'')"` que remove formatação, e `onblur="formatarMoeda(this);editarCampoInput(this)"`. Ao trocar de aba, o `renderizarTabelaAnalises()` re-renderiza a tabela do zero, mas o `formatarMoeda` pode estar sendo chamado de forma inconsistente.

**Arquivo:** `index.html` — `renderizarTabelaAnalises()` (~linha 3043)

**Ação:**
- Nos inputs de valor_imovel e valor_financiado, garantir que o `value` renderizado já venha formatado com "R$ " antes de exibir
- Adicionar um formatador no início do render: se o valor começar com dígito (sem R$), adicionar "R$ " + número formatado
- Não usar `oninput` que limpa a formatação — usar `onfocus` para remover máscara e `onblur` para aplicar

---

## Fix 5: Formatação R$ nos campos de valor na Aba 1

**Mesmo diagnóstico do Fix 4.** 

**Ação:**
- `onfocus`: salvar valor bruto (só dígitos), mostrar dígitos puros
- `onblur`: aplicar `formatarMoeda`, depois `editarCampoInput`
- Remover `oninput="this.value=this.value.replace(/[^\d]/g,'')"` dos inputs de valor

---

## Fix 6: Campo Indicação com autocomplete da lista de PARCEIROS

**Diagnóstico atual:** O `<input>` de indicação já tem `list="indicacaoSuggestions"` que é populado por `popularDatalistIndicacoes()`. Mas o comportamento pode não estar puxando corretamente.

**Arquivo:** `index.html` — `popularDatalistIndicacoes()` e o `<datalist id="indicacaoSuggestions">`

**Ação:**
- Garantir que o datalist é populado com TODOS os nomes de parceiros (de `carregarIndicacoes()`) + indicações já existentes no banco (`extrairIndicacoesDoBanco()`)
- Chamar `popularDatalistIndicacoes()` após cada `carregarDados()`
- Adicionar `autocomplete="off"` no input para o datalist nativo funcionar corretamente

---

## Fix 7: Dilatar coluna Cliente na Aba 1

**Diagnóstico:** O `<span contenteditable>` do cliente tem `width` limitado, fazendo nomes longos quebrarem linha.

**Arquivo:** `index.html` — `renderizarTabelaAnalises()` (~linha 3058)

**Ação:**
- No `<span contenteditable>` do campo cliente: adicionar `style="min-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"`
- Aumentar a largura da coluna Cliente no `<th>` correspondente: adicionar classe ou `style="min-width:160px;"`

---

## Fix 8: Botão Expandir na Aba 2 em maior destaque

**Diagnóstico:** O `▼` é pequeno (0.65rem) e opaco (opacity:0.6), difícil de ver.

**Arquivo:** `index.html` — CSS `.expand-btn` (~linha 323) e HTML da tabela

**Ação:**
- CSS: `font-size: 1rem; opacity: 0.85; font-weight: bold;`
- Cor: `color: var(--accent);` (laranja no claro, mesmo laranja no escuro)
- Adicionar `background: var(--bg-card); border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;`
- No hover: `opacity: 1; transform: scale(1.15);`

---

## Fix 9: Dash puxar data atual e mostrar processos do mês corrente

**Diagnóstico:** O dashboard atual usa `getAlertasPrazoExcedido()`, `getAlertasUrgentes()`, `getAlertasMatricula()`, `getAlertasIQ()` que filtram por regras específicas (30 dias, urgente, etc.). O usuário quer ver TODOS os processos do mês corrente, independente de filtros.

**Arquivo:** `index.html` — `renderizarDashboard()` + novas funções

**Ação:**
- Criar função auxiliar: `getMesCorrente()` que retorna `YYYY-MM` do mês atual
- Adicionar seção no topo do dash: "Processos do mês: X" mostrando contagem de todos os processos com `mes_referencia === getMesCorrente()` OU `convertido === true` (independente de alerta)
- Manter os cards de alerta existentes abaixo dessa seção
- Card novo: "Ativos este mês" com badge verde e contador

---

## Ordem de execução recomendada

1. Fix 2 (cabeçalhos F-U / Conv.) — mais simples, testa deploy rápido
2. Fix 7 (dilatar coluna Cliente)
3. Fix 5 (formatação R$ nos valores)  
4. Fix 4 (valores não somem ao trocar aba)
5. Fix 6 (autocomplete indicação por parceiros)
6. Fix 3 (convertido permanece na Aba 1 sem clones)
7. Fix 1 (coluna Criado por integrada)
8. Fix 8 (botão expandir destacado)
9. Fix 9 (dash com mês corrente)

---

## Validação

- [ ] Coluna Criado por não parece separada ao fazer hover
- [ ] Cabeçalhos mostram "F-U" e "Conv." com tooltip
- [ ] Converter cliente: permanece na Aba 1, vai pra Aba 2, desmarcar não clona
- [ ] Valores R$ não somem ao trocar de aba
- [ ] Input de valores tem máscara R$ correta (focus/blur)
- [ ] Indicação autocompleta com parceiros cadastrados
- [ ] Coluna Cliente não quebra nomes em múltiplas linhas
- [ ] Botão expandir visível com cor de destaque
- [ ] Dash mostra contagem de processos do mês corrente
