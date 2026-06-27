# Calendário de Compromissos na Aba Dash

> **Para Hermes:** Implementar direto no index.html seguindo as tarefas abaixo. Sem refatorar, sem extrair JS/CSS.

**Goal:** Adicionar um calendário do mês corrente na aba Dashboard, abaixo dos cards de alerta, exibindo vencimentos de IQ, matrícula e próximos follow-ups.

**Architecture:** Calendário vanilla JS puro (sem biblioteca), renderizado como grid 7 colunas dentro de um card centralizado abaixo dos alertas. Dados vêm do array global `clientes` (já carregado), filtrando por mês corrente. Dias com evento ganham dots coloridos e tooltip no hover.

**Tech Stack:** HTML + CSS + JS vanilla (já no index.html), Tailwind CDN, dados do Supabase já em memória.

---

## Visual proposto

```
┌─────────────────────────────────────────────┐
│          Junho 2026                          │
│  Dom  Seg  Ter  Qua  Qui  Sex  Sáb          │
│        1    2    3    4    5    6           │
│   7    8    9   10   11   12   13            │
│  14   15   16   17   18   19   20            │
│  21   22   23   24   25   26   27            │
│  28   29   30                                 │
│                                              │
│  ● Matrícula  ● IQ  ● Follow-up             │
└─────────────────────────────────────────────┘
```

Dias com eventos:
```
┌──────┐
│  15  │
│ ●●   │  ← 2 dots: Matrícula + IQ nesse dia
└──────┘
```

---

## Dados utilizados

| Fonte | Campo | Formato | Filtro |
|-------|-------|---------|--------|
| Aba 2 (Andamento) | `data_matricula` | `dd/mm/aaaa` | `convertido===true`, mês corrente |
| Aba 2 (Andamento) | `data_iq` | `dd/mm/aaaa` | `convertido===true`, mês corrente, `iq===true` |
| Aba FU | `proximo_fu` | `dd/mm/aaaa` | `follow_up===true`, mês corrente |

---

## Tarefas

### Task 1: Adicionar CSS do calendário no `<style>` do index.html

**Objective:** Inserir estilos do grid do calendário, dots coloridos e tooltip.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — bloco `<style>` (~linha 600)

**Step 1: Inserir CSS**

Inserir antes de `</style>` (após a última regra existente):

```css
  /* ===== CALENDÁRIO DASH ===== */
  .calendario-dash {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .cal-header {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cal-header button {
    background: none; border: 1px solid var(--border);
    color: var(--text-secondary); border-radius: 6px;
    padding: 2px 8px; cursor: pointer; font-size: 14px; line-height: 1;
  }
  .cal-header button:hover { border-color: var(--accent); color: var(--accent); }
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    max-width: 320px;
    width: 100%;
    font-size: 11px;
  }
  .cal-day-header {
    text-align: center;
    font-weight: 600;
    color: var(--accent);
    padding: 4px 0;
    font-size: 10px;
    text-transform: uppercase;
  }
  .cal-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    cursor: default;
    position: relative;
    color: var(--text);
    transition: background 0.15s;
  }
  .cal-cell:hover { background: var(--row-hover); }
  .cal-cell.empty { cursor: default; }
  .cal-cell.hoje {
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    border-radius: 50%;
    width: 28px; height: 28px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cal-cell.hoje:hover { background: var(--accent-hover); }
  .cal-dot-row {
    display: flex;
    gap: 2px;
    margin-top: 1px;
    justify-content: center;
  }
  .cal-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    display: inline-block;
  }
  .cal-dot.matricula { background: #d97706; }
  .cal-dot.iq { background: #7c3aed; }
  .cal-dot.fu { background: #3b82f6; }
  .cal-legenda {
    display: flex;
    gap: 12px;
    font-size: 10px;
    color: var(--text-muted);
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 4px;
  }
  .cal-legenda-item { display: flex; align-items: center; gap: 4px; }
  .cal-legenda-dot { width: 6px; height: 6px; border-radius: 50%; }
  .cal-tooltip {
    display: none;
    position: absolute;
    bottom: 110%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-toast);
    color: var(--text-inverse);
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
    z-index: 999;
    pointer-events: none;
    box-shadow: var(--shadow-md);
  }
  .cal-cell:hover .cal-tooltip { display: block; }
```

**Verificação:** Nenhum erro de sintaxe CSS. As variáveis CSS (`--accent`, `--text`, etc.) já existem no `:root`.

---

### Task 2: Criar função `coletarEventosCalendario()`

**Objective:** Função que coleta todos os eventos do mês corrente a partir do array `clientes`.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — bloco `<script>` abaixo de `cardAlerta()` (~linha 2548)

**Step 1: Inserir função**

Inserir **antes** de `function renderizarDashboard()`:

```javascript
// ========== CALENDÁRIO DASH ==========
function coletarEventosCalendario() {
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoAtual = String(hoje.getFullYear());
  const mesRef = anoAtual + '-' + mesAtual;

  // Só pegar clientes do mês corrente
  const doMes = clientes.filter(c => c.mes_referencia === mesRef && !c.deleted_at);

  const eventos = {}; // key: "D" (dia numérico) → { matricula: [nomes], iq: [nomes], fu: [nomes] }

  const adicionar = (dia, tipo, nome) => {
    if (!dia || dia < 1 || dia > 31) return;
    if (!eventos[dia]) eventos[dia] = { matricula: [], iq: [], fu: [] };
    if (!eventos[dia][tipo].includes(nome)) eventos[dia][tipo].push(nome);
  };

  doMes.forEach(c => {
    // Matrícula — Aba 2 (convertido=true, não emitido)
    if (c.convertido === true && c.status !== 'emitido' && c.data_matricula) {
      const dt = parseDataBR(c.data_matricula);
      if (dt && dt.getMonth() + 1 === hoje.getMonth() + 1 && dt.getFullYear() === hoje.getFullYear()) {
        adicionar(dt.getDate(), 'matricula', c.cliente || 'Sem nome');
      }
    }
    // IQ — Aba 2 (convertido=true, não emitido, tem IQ ativo)
    if (c.convertido === true && c.status !== 'emitido' && c.iq && c.data_iq) {
      const dt = parseDataBR(c.data_iq);
      if (dt && dt.getMonth() + 1 === hoje.getMonth() + 1 && dt.getFullYear() === hoje.getFullYear()) {
        adicionar(dt.getDate(), 'iq', c.cliente || 'Sem nome');
      }
    }
    // Próximo F-U — Aba FU (follow_up=true)
    if (c.follow_up === true && c.convertido !== true && c.status !== 'emitido' && c.proximo_fu) {
      const dt = parseDataBR(c.proximo_fu);
      if (dt && dt.getMonth() + 1 === hoje.getMonth() + 1 && dt.getFullYear() === hoje.getFullYear()) {
        adicionar(dt.getDate(), 'fu', c.cliente || 'Sem nome');
      }
    }
  });

  return eventos;
}
```

**Verificação:** `parseDataBR()` já existe no código (linha ~2462). A função retorna um objeto indexado por dia numérico.

---

### Task 3: Criar função `renderizarCalendarioDash()`

**Objective:** Função que monta o HTML do calendário e insere no container do dashboard.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — após `coletarEventosCalendario()`

**Step 1: Inserir função**

Inserir após `coletarEventosCalendario()`:

```javascript
function renderizarCalendarioDash() {
  const hoje = new Date();
  const mes = hoje.getMonth();      // 0-indexed
  const ano = hoje.getFullYear();
  const diaHoje = hoje.getDate();

  const primeiroDia = new Date(ano, mes, 1).getDay(); // 0=Dom
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();

  const eventos = coletarEventosCalendario();

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  let html = `<div class="calendario-dash">`;
  // Cabeçalho
  html += `<div class="cal-header"><span>${meses[mes]} ${ano}</span></div>`;
  // Dias da semana
  html += `<div class="cal-grid">`;
  diasSemana.forEach(d => { html += `<div class="cal-day-header">${d}</div>`; });
  // Células vazias antes do dia 1
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="cal-cell empty"></div>`;
  }
  // Dias do mês
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const evts = eventos[dia] || { matricula: [], iq: [], fu: [] };
    const temEvento = evts.matricula.length > 0 || evts.iq.length > 0 || evts.fu.length > 0;
    const ehHoje = dia === diaHoje;

    let dotsHtml = '';
    if (temEvento) {
      dotsHtml = '<div class="cal-dot-row">';
      if (evts.matricula.length > 0) dotsHtml += `<span class="cal-dot matricula"></span>`;
      if (evts.iq.length > 0) dotsHtml += `<span class="cal-dot iq"></span>`;
      if (evts.fu.length > 0) dotsHtml += `<span class="cal-dot fu"></span>`;
      dotsHtml += '</div>';
    }

    let tooltipHtml = '';
    if (temEvento) {
      const partes = [];
      if (evts.matricula.length > 0) partes.push(`📋 ${evts.matricula.join(', ')}`);
      if (evts.iq.length > 0) partes.push(`🔔 ${evts.iq.join(', ')}`);
      if (evts.fu.length > 0) partes.push(`📞 ${evts.fu.join(', ')}`);
      tooltipHtml = `<div class="cal-tooltip">${partes.join('<br>')}</div>`;
    }

    html += `<div class="cal-cell${ehHoje ? ' hoje' : ''}">${tooltipHtml}<span>${dia}</span>${dotsHtml}</div>`;
  }
  html += `</div>`; // fecha cal-grid

  // Legenda
  html += `<div class="cal-legenda">
    <div class="cal-legenda-item"><span class="cal-legenda-dot matricula"></span> Matrícula</div>
    <div class="cal-legenda-item"><span class="cal-legenda-dot iq"></span> IQ</div>
    <div class="cal-legenda-item"><span class="cal-legenda-dot fu"></span> Follow-up</div>
  </div>`;

  html += `</div>`; // fecha calendario-dash
  return html;
}
```

**Verificação:** A função é pura, sem side-effects, retorna string HTML.

---

### Task 4: Integrar o calendário no `renderizarDashboard()`

**Objective:** Adicionar o HTML do calendário abaixo dos cards de alerta.

**Files:**
- Modify: `C:\Users\Prime04D\crm-uaicred\index.html` — função `renderizarDashboard()` (~linha 2615)

**Step 1: Adicionar seção do calendário**

No `container.innerHTML` da `renderizarDashboard()`, após o fechamento da `<div class="grid ...">` dos cards (linha 2629), adicionar uma nova `<div>` com o calendário:

**Antes (linha ~2630):**
```javascript
    </div>
  `;
}
```

**Depois:**
```javascript
    </div>
    <div class="mt-6 flex justify-center">
      <div class="p-4 rounded-2xl border shadow-sm" style="background:var(--bg-card);border-color:var(--border);max-width:380px;width:100%;">
        ${renderizarCalendarioDash()}
      </div>
    </div>
  `;
}
```

**Verificação:** O calendário aparece centralizado abaixo dos cards, com espaçamento `mt-6`. Largura máxima 380px.

---

### Task 5: Testar e validar

**Objective:** Verificar que o calendário renderiza corretamente sem quebrar o dashboard existente.

**Step 1: Abrir o CRM e verificar**

Abrir `crm-primerms.vercel.app` no browser (já em produção após deploy) e verificar:
- Aba Dashboard carrega normalmente
- Cards de alerta continuam funcionando
- Calendário aparece abaixo, centralizado
- Mês e ano corretos
- Hoje destacado em laranja
- Dias com eventos mostram dots coloridos
- Hover mostra tooltip com nomes dos clientes
- Legenda visível abaixo do calendário

**Step 2: Verificar sem eventos**

Em um mês sem vencimentos, o calendário deve aparecer normalmente, só sem dots.

**Step 3: Verificar tema escuro**

Alternar para tema escuro — o calendário deve usar as variáveis CSS e ficar legível.

---

## Riscos

- **Nenhum.** A feature é read-only, não altera dados, não toca em funções existentes. Usa `clientes[]` já carregado. Se `parseDataBR()` falhar numa data inválida, o evento simplesmente não aparece naquele dia — sem crash.
- Performance: `coletarEventosCalendario()` itera `clientes` uma vez (~centenas de registros). O(n). Desprezível.

## Verificação pós-deploy

1. `git push` + `vercel --prod`
2. Abrir https://crm-primerms.vercel.app
3. Clicar na aba Dashboard
4. Confirmar calendário visível, mês correto, dots nos dias certos
5. Hover nos dots → tooltip com nomes

---

## Ideias de evolução futura

- Permitir navegar entre meses (setas ◀ ▶)
- Clicar no dia para filtrar a Aba 2/FU por aquela data
- Destaque visual mais forte em dias com múltiplos eventos (borda colorida)
- Badge de contagem: "3 eventos" no canto da célula
