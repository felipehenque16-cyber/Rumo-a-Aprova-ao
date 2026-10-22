(function () {
'use strict';

/* ================= Dados e índices ================= */
const TOPICS = window.TOPICS;
const QS = window.QUESTIONS;
const ED = window.EDITAL;
const QMAP = Object.fromEntries(QS.map(q => [q.id, q]));
const TMAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const ANAME = {};
TOPICS.forEach(t => t.assuntos.forEach(a => { ANAME[t.id + ':' + a.id] = a.name; }));
const LETTERS = ['A', 'B', 'C', 'D'];
const EXAM_DATE = new Date(ED.prova);
const SEC_PER_Q = 270; // 3 h para 40 questões = 4,5 min por questão
const peso = q => (q.t === 'gerais' ? 1 : 2);

/* ================= Estado (em memória, com exportação/importação) ================= */
function blankState() { return { attempts: {}, sims: [], read: {}, sessions: [], agenda: [], metaHoras: 12 }; }
let state = blankState();
let dirty = false;
let localProgressOwnerId = null;
const LOCAL_PROGRESS_KEY = 'caderno-ss:progress:v1';
let localSaveFailed = false;
function persistLocalProgress() {
  try {
    const data = JSON.parse(exportCode()).data;
    data.bankAnswers = typeof bankAnswers === 'undefined' ? {} : bankAnswers;
    data.bankReveal = typeof bankReveal === 'undefined' ? {} : bankReveal;
    data.exam = typeof exam !== 'undefined' && exam && !exam.finished ? Object.assign({}, exam, { paused: true }) : null;
    const ownerId = typeof auth !== 'undefined' && auth ? auth.user.id : localProgressOwnerId;
    localProgressOwnerId = ownerId || null;
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify({ app: 'caderno-ss', version: 1, ownerId: localProgressOwnerId, data }));
    localSaveFailed = false;
    return true;
  } catch (e) {
    if (!localSaveFailed && typeof toast === 'function') toast('Não foi possível salvar neste aparelho. Use “Exportar progresso” para guardar uma cópia.');
    localSaveFailed = true;
    return false;
  }
}
function clearLocalProgress() {
  try { localStorage.removeItem(LOCAL_PROGRESS_KEY); localProgressOwnerId = null; localSaveFailed = false; } catch (e) { localSaveFailed = true; }
}
function save() {
  persistLocalProgress();
  dirty = !!auth;
  if (typeof onSave === 'function') onSave();
}
function exportCode() { return JSON.stringify({ app: 'caderno-ss', v: 3, at: Date.now(), data: { attempts: state.attempts, sims: state.sims, read: state.read, sessions: state.sessions, agenda: state.agenda, metaHoras: state.metaHoras } }); }
function importCode(txt) {
  const obj = JSON.parse(txt);
  const d = obj && obj.data ? obj.data : obj;
  if (!d || typeof d !== 'object' || !d.attempts) throw new Error('formato');
  const valid = id => !!QMAP[id];
  const attempts = {}; Object.keys(d.attempts).forEach(k => { if (valid(k)) attempts[k] = d.attempts[k]; });
  state = Object.assign(blankState(), { attempts, sims: (d.sims || []).filter(s => s.qs && s.qs.every(valid)), read: d.read || {},
    sessions: Array.isArray(d.sessions) ? d.sessions.filter(x => x && x.start && x.dur > 0) : [],
    agenda: Array.isArray(d.agenda) ? d.agenda.filter(x => x && x.dia >= 0 && x.dia <= 6 && x.hora) : [],
    metaHoras: d.metaHoras >= 1 && d.metaHoras <= 80 ? d.metaHoras : 12 });
  dirty = false;
}
function recordAttempt(qid, ok) {
  const a = state.attempts[qid] || { n: 0, ok: 0 };
  a.n += 1; if (ok) a.ok += 1; a.last = ok; a.ts = Date.now();
  state.attempts[qid] = a;
}

/* ================= Utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const fmtNum = n => String(Math.round(n * 10) / 10).replace('.', ',');
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtTime(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; const mm = String(m).padStart(2, '0'), ss = String(x).padStart(2, '0'); return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`; }
function fmtDur(s) { const m = Math.round(s / 60); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + String(r).padStart(2, '0') : ''); }
function fmtDate(ts) { const d = new Date(ts); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtDay(d) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function lvl(p) { return p >= 70 ? 'ok' : p >= 50 ? 'mid' : 'low'; }
function difLabel(d) { return ['', 'Fácil', 'Média', 'Difícil'][d] || ''; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
function icons() { if (window.lucide) window.lucide.createIcons(); }
function daysLeft() { return Math.ceil((EXAM_DATE - Date.now()) / 86400000); }
const pctCell = (s) => s.n ? `<span class="pct ${lvl(s.p)}">${s.p}%</span>` : '<span class="faint">—</span>';
const barCell = (s) => `<div class="bar ${s.n ? lvl(s.p) : ''}"><span style="width:${s.n ? s.p : 0}%"></span></div>`;

function modal({ title, body, confirm = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return new Promise(resolve => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="scrim show" style="z-index:90" data-m="cancel"></div>
      <div role="dialog" aria-modal="true" aria-labelledby="m-title" class="dialog">
        <h3 id="m-title">${title}</h3>
        <div class="muted small" style="margin-bottom:var(--space-5)">${body}</div>
        <div class="btn-row" style="justify-content:flex-end">
          ${cancel ? `<button class="btn" data-m="cancel">${cancel}</button>` : ''}
          <button class="btn btn-primary ${danger ? 'btn-danger' : ''}" data-m="ok">${confirm}</button>
        </div>
      </div>`;
    const done = v => { root.innerHTML = ''; resolve(v); };
    root.querySelectorAll('[data-m]').forEach(el => el.addEventListener('click', () => done(el.dataset.m === 'ok')));
    root.querySelector('[data-m="ok"]').focus();
  });
}

/* ================= Estatísticas ================= */
function statsFor(filterFn) {
  let n = 0, ok = 0, seen = 0, total = 0;
  QS.forEach(q => { if (!filterFn(q)) return; total++; const a = state.attempts[q.id]; if (a && !isPending(q.id)) { n += a.n; ok += a.ok; seen++; } });
  return { n, ok, seen, total, p: pct(ok, n) };
}
const topicStats = tid => statsFor(q => q.t === tid);
const assuntoStats = (tid, aid) => statsFor(q => q.t === tid && q.a === aid);
const readCount = t => t.sections.filter(s => state.read[t.id + ':' + s.assunto]).length;

/* ================= Cabeçalho e navegação ================= */
function renderMast() {
  const d = daysLeft();
  $('#mh-exam').innerHTML = d > 0
    ? `<span class="mh-lbl">Prova objetiva</span><span class="mh-date"><b>dom., 10/01/2027</b> · 8h às 11h</span><span class="mh-count" title="Dias até a prova"><b>${d}</b> ${d === 1 ? 'dia' : 'dias'}</span>`
    : `<span class="mh-lbl">Prova objetiva realizada em 10/01/2027</span>`;
  const swEl = $('#mh-sw');
  if (swEl) { swEl.hidden = !sw; swEl.innerHTML = sw ? `<i data-lucide="timer"></i><span id="mh-sw-time">${fmtTime(sw.acc)}</span>` : ''; }
}

function renderNav(route) {
  const link = (href, label, active, extra = '') => `<a class="nav-link ${active ? 'active' : ''}" href="${href}"><span class="nav-text">${label}</span>${extra}</a>`;
  const r0 = route[0];
  $('#nav').innerHTML = `
    <div class="nav-label">Concurso</div>
    ${link('#/', 'Painel', r0 === '')}
    ${link('#/edital', 'Edital e prova', r0 === 'edital')}
    <div class="nav-label">Prática</div>
    ${link('#/questoes', 'Resolver questões', r0 === 'questoes')}
    ${link('#/simulado', 'Simulador de prova', r0 === 'simulado', exam && !exam.finished ? '<span class="nav-tag">em andamento</span>' : '')}
    ${link('#/desempenho', 'Desempenho', r0 === 'desempenho')}
    ${link('#/erros', 'Caderno de erros', r0 === 'erros', errCount() ? `<span class="nav-prog">${errCount()}</span>` : '')}
    <div class="nav-label">Organização</div>
    ${link('#/estudo', 'Tempo de estudo', r0 === 'estudo', sw ? `<span class="nav-tag tnum" id="nav-sw-time">${fmtTime(sw.acc)}</span>` : '')}
    ${link('#/cronograma', 'Meu cronograma', r0 === 'cronograma', state.agenda.length ? `<span class="nav-prog">${state.agenda.filter(x => x.done).length}/${state.agenda.length}</span>` : '')}
    <div class="nav-label">Conteúdo programático</div>
    ${TOPICS.map(t => `<a class="nav-link ${r0 === 'topico' && route[1] === t.id ? 'active' : ''}" href="#/topico/${t.id}">
      <span class="nav-num">${t.num}</span><span class="nav-text">${esc(t.title)}</span><span class="nav-prog" title="Resumos lidos">${readCount(t)}/${t.sections.length}</span></a>`).join('')}`;
}
const errCount = () => QS.filter(q => state.attempts[q.id] && state.attempts[q.id].last === false && !isPending(q.id)).length;

function parseRoute() { return (location.hash.replace(/^#\/?/, '') || '').split('/'); }

let chartRef = null;
function router() {
  const r = parseRoute();
  renderMast(); renderNav(r); closeMenu();
  const c = $('#content');
  if (chartRef) { chartRef.destroy(); chartRef = null; }
  if (r[0] === 'topico' && TMAP[r[1]]) c.innerHTML = viewTopic(TMAP[r[1]], r[2] || 'resumo');
  else if (r[0] === 'edital') c.innerHTML = viewEdital();
  else if (r[0] === 'questoes') c.innerHTML = viewPractice(r[1]);
  else if (r[0] === 'simulado' && r[1] === 'prova') c.innerHTML = exam && !exam.finished ? viewExam() : viewConfig();
  else if (r[0] === 'simulado' && r[1] === 'resultado') c.innerHTML = viewResult(r[2]);
  else if (r[0] === 'simulado') c.innerHTML = viewConfig();
  else if (r[0] === 'desempenho') c.innerHTML = viewStats();
  else if (r[0] === 'erros') c.innerHTML = viewErrors();
  else if (r[0] === 'estudo') c.innerHTML = viewStudy();
  else if (r[0] === 'cronograma') c.innerHTML = viewAgenda();
  else c.innerHTML = viewHome();
  icons();
  if (r[0] === 'desempenho') drawChart();
  if (r[0] === 'simulado' && !r[1]) updateConfigSummary();
  if (r[0] === 'simulado' && r[1] === 'prova') updateTimerEl();
  if (!router.first) window.scrollTo(0, 0);
  router.first = false;
}
router.first = true;

/* ================= Plano de estudos ================= */
function studyPlan() {
  const DAY = 86400000;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const start = new Date(now.getTime() - ((now.getDay() + 6) % 7) * DAY); // segunda-feira
  const end = new Date(EXAM_DATE); end.setHours(0, 0, 0, 0);
  const weeks = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 7 * DAY)) {
    const fim = new Date(Math.min(d.getTime() + 6 * DAY, end.getTime()));
    weeks.push({ ini: d, fim });
  }
  if (!weeks.length) return [];
  const order = ['ssedu', 'poledu', 'seg', 'direitos', 'tecop', 'etica', 'fund', 'gerais'];
  const nStudy = Math.max(1, weeks.length - 2);
  const extra = ['poledu', 'seg', 'direitos', 'ssedu'];
  let seq = order.slice();
  for (let i = 0; seq.length < nStudy; i++) { const id = extra[i % extra.length]; const pos = seq.lastIndexOf(id); seq.splice(pos + 1, 0, id); }
  // Se houver menos semanas que tópicos, agrupa dois tópicos por semana
  const slots = [];
  if (seq.length > nStudy) { const per = Math.ceil(seq.length / nStudy); for (let i = 0; i < seq.length; i += per) slots.push(seq.slice(i, i + per)); }
  else seq.forEach(id => slots.push([id]));
  return weeks.map((w, i) => {
    const isLast = i === weeks.length - 1, isPenult = i === weeks.length - 2 && weeks.length > 2;
    let foco, meta;
    if (isLast) { foco = 'Revisão final: pegadinhas, quadros-resumo e caderno de erros'; meta = 'Leitura leve; sem conteúdo novo'; }
    else if (isPenult) { foco = 'Simulados no formato da prova e revisão dos assuntos abaixo de 70%'; meta = '2 simulados de 20 questões'; }
    else { const ids = slots[Math.min(i, slots.length - 1)] || []; foco = ids.map(id => `<a href="#/topico/${id}">${TMAP[id].num} · ${esc(TMAP[id].title)}</a>`).join('<br>'); const nq = ids.reduce((s, id) => s + QS.filter(q => q.t === id).length, 0); meta = `Resumos + ${nq} questões do banco`; }
    const cur = now >= w.ini && now <= new Date(w.ini.getTime() + 6 * DAY);
    return { n: i + 1, per: fmtDay(w.ini) + ' a ' + fmtDay(w.fim), foco, meta, cur };
  });
}

/* ================= Painel ================= */
function nextUnread() {
  for (const t of TOPICS) for (const s of t.sections) if (!state.read[t.id + ':' + s.assunto]) return { t, s };
  return null;
}
function viewHome() {
  const all = statsFor(() => true);
  const sims = state.sims;
  const best = sims.length ? Math.max(...sims.map(s => s.score)) : null;
  const totalSections = TOPICS.reduce((s, t) => s + t.sections.length, 0);
  const totalRead = Object.keys(state.read).length;
  const nu = nextUnread();
  const plan = studyPlan();
  const weak = weakest(4);
  const d = daysLeft();
  return `
  <div class="page-head">
    <div class="crumb">Edital nº 01/2026 · Prefeitura Municipal de Campina Grande/PB · IDECAN</div>
    <h1 class="page-title">Assistente Social Educacional</h1>
    <p class="page-lead">Conteúdo organizado pelos itens do edital, com questões comentadas no formato da prova (quatro alternativas) e simulador cronometrado.</p>
  </div>

  ${typeof auth !== 'undefined' && auth ? '' : `<div class="acct-banner"><div><b>Guarde seu progresso</b><span class="small muted">Com uma conta, suas respostas, simulados, cronograma e tempo de estudo ficam salvos e podem ser retomados em qualquer aparelho.</span></div><div class="btn-row"><button class="btn btn-primary btn-sm" data-action="open-login" data-mode="cadastro">Criar conta</button><button class="btn btn-sm" data-action="open-login">Entrar</button></div></div>`}
  <div class="strip">
    <div><div class="strip-label">Estudo nesta semana</div><div class="strip-value">${hm(studiedSince(weekStart()))}</div><div class="strip-sub">meta de ${state.metaHoras} h · ${d > 0 ? d : 0} dias até a prova</div></div>
    <div><div class="strip-label">Resumos lidos</div><div class="strip-value">${totalRead}<small> / ${totalSections}</small></div><div class="strip-sub">${pct(totalRead, totalSections)}% do conteúdo</div></div>
    <div><div class="strip-label">Questões resolvidas</div><div class="strip-value">${all.seen}</div><div class="strip-sub">${all.n ? all.p + '% de acerto' : 'nenhuma ainda'} · <a href="#/questoes">resolver</a></div></div>
    <div><div class="strip-label">Simulados</div><div class="strip-value">${sims.length}</div><div class="strip-sub">${best !== null ? 'melhor: ' + best + '%' : 'nenhum realizado'}</div></div>
  </div>

  <div class="cols">
    <div class="stack">
      <section class="panel">
        <div class="panel-head"><h2>Conteúdo programático</h2><span class="xs">Conhecimentos específicos e seleção dos gerais</span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Nº</th><th>Tópico</th><th class="num">Resumos</th><th class="num hide-sm">Questões</th><th class="num">Acerto</th></tr></thead>
          <tbody>${TOPICS.map(t => { const s = topicStats(t.id); return `<tr>
            <td class="tnum faint">${t.num}</td>
            <td><a class="row-link" href="#/topico/${t.id}">${esc(t.title)}</a><div class="xs muted">${esc(t.short)}</div></td>
            <td class="num">${readCount(t)}/${t.sections.length}</td>
            <td class="num hide-sm">${s.seen}/${s.total}</td>
            <td class="num">${pctCell(s)}</td></tr>`; }).join('')}</tbody>
        </table></div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Plano de estudos até a prova</h2><span class="xs">${plan.length} semanas · gerado a partir da data de hoje</span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Sem.</th><th>Período</th><th>Foco</th><th class="hide-sm">Meta</th></tr></thead>
          <tbody>${plan.map(w => `<tr class="${w.cur ? 'hl' : ''}"><td class="tnum">${w.n}${w.cur ? ' <span class="tag primary">atual</span>' : ''}</td><td class="tnum" style="white-space:nowrap">${w.per}</td><td>${w.foco}</td><td class="hide-sm muted">${w.meta}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
    </div>

    <div class="stack">
      ${homeOrgPanel()}
      <section class="panel">
        <div class="panel-head"><h2>Próximo passo</h2></div>
        <div class="panel-body">
          ${nu ? `<p class="small" style="margin-bottom:var(--space-3)">Próximo resumo não lido:<br><a href="#/topico/${nu.t.id}/resumo?s=${nu.s.assunto}"><b>${esc(nu.s.title)}</b></a><br><span class="xs muted">Tópico ${nu.t.num} · ${esc(nu.t.title)}</span></p>` : '<p class="small">Todos os resumos foram lidos. Concentre-se em simulados e no caderno de erros.</p>'}
          <div class="btn-row">
            <button class="btn btn-primary" data-action="preset-sim" data-p="prova">Simulado no formato da prova</button>
            <a class="btn" href="#/questoes">Resolver questões</a>
          </div>
          <p class="xs muted" style="margin:var(--space-3) 0 0">20 questões de conhecimentos específicos, 90 minutos — mesmo ritmo da prova (3 h para 40 questões).</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Ficha do concurso</h2><a class="xs" href="#/edital">Edital completo</a></div>
        <table class="tbl"><tbody>
          ${ED.ficha.filter(f => ['Cargo', 'Banca', 'Remuneração', 'Jornada', 'Vagas', 'Prova objetiva'].includes(f[0])).map(f => `<tr><td class="k">${f[0]}</td><td>${esc(f[1])}</td></tr>`).join('')}
        </tbody></table>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Composição da prova</h2></div>
        <table class="tbl">
          <thead><tr><th>Disciplina</th><th class="num">Quest.</th><th class="num">Pontos</th></tr></thead>
          <tbody>${ED.composicao.map(c => `<tr><td>${c[1]}${c[5] ? '' : ' <span class="xs faint">(fora do escopo)</span>'}</td><td class="num">${c[2]}</td><td class="num">${c[4]}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td><td class="num">40</td><td class="num">60,00</td></tr></tfoot>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Assuntos a reforçar</h2></div>
        ${weak.length ? `<table class="tbl"><tbody>${weak.map(w => `<tr><td><a class="row-link" href="#/topico/${w.t}/questoes?a=${w.a}">${esc(w.name)}</a><div class="xs muted">${TMAP[w.t].num} · ${esc(TMAP[w.t].title)}</div></td><td class="num mid"><span class="pct ${lvl(w.p)}">${w.p}%</span></td></tr>`).join('')}</tbody></table>`
          : '<div class="empty-inline">Os assuntos com menor aproveitamento aparecem aqui depois que você resolver questões.</div>'}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Últimos simulados</h2></div>
        ${sims.length ? sims.slice(-4).reverse().map(histItem).join('') : '<div class="empty-inline">Nenhum simulado realizado.</div>'}
      </section>
    </div>
  </div>
  ${footerNote()}`;
}

function histItem(s) {
  return `<div class="hist-item">
    <div><div style="font-weight:500">${s.n} questões · ${s.mode === 'treino' ? 'treino' : 'prova'}</div><div class="xs muted">${fmtDate(s.date)} · ${fmtTime(s.used)}</div></div>
    <span class="pct ${lvl(s.score)}">${s.score}%</span>
    <a class="btn btn-sm hide-sm" href="#/simulado/resultado/${s.id}">Abrir</a>
  </div>`;
}

function weakest(k) {
  const arr = [];
  TOPICS.forEach(t => t.assuntos.forEach(a => { const s = assuntoStats(t.id, a.id); if (s.n >= 2) arr.push({ t: t.id, a: a.id, name: a.name, p: s.p, n: s.n }); }));
  return arr.sort((x, y) => x.p - y.p || y.n - x.n).filter(x => x.p < 100).slice(0, k);
}

function footerNote() {
  return `<div class="footer-note">
    Informações do concurso conforme o <a href="${ED.links.edital}" target="_blank" rel="noopener">Edital nº 01/2026 (PMCG/IDECAN)</a> e a <a href="${ED.links.retif5}" target="_blank" rel="noopener">Retificação nº 05/2026</a>; acompanhe novas retificações no site da banca.
    As questões foram elaboradas para este material, no formato e no padrão de cobrança da IDECAN; não são reproduções de provas.
    Textos legais conferidos no Planalto: <a href="https://www.planalto.gov.br/ccivil_03/leis/l9394.htm" target="_blank" rel="noopener">LDB</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/L13935.htm" target="_blank" rel="noopener">Lei 13.935/2019</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15388.htm" target="_blank" rel="noopener">PNE (Lei 15.388/2026)</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/L14113.htm" target="_blank" rel="noopener">Fundeb</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/leis/l8662.htm" target="_blank" rel="noopener">Lei 8.662/1993</a>,
    <a href="https://www.cfess.org.br/arquivos/CEP_CFESS-SITE.pdf" target="_blank" rel="noopener">Código de Ética</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/leis/l8742.htm" target="_blank" rel="noopener">LOAS</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/leis/l8069.htm" target="_blank" rel="noopener">ECA</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm" target="_blank" rel="noopener">Lei Maria da Penha</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741.htm" target="_blank" rel="noopener">Estatuto da Pessoa Idosa</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm" target="_blank" rel="noopener">Estatuto da Pessoa com Deficiência</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/L14601.htm" target="_blank" rel="noopener">Bolsa Família</a>,
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener">LGPD</a> e
    <a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm" target="_blank" rel="noopener">LAI</a>.
    ${typeof auth !== 'undefined' && auth ? `Progresso salvo neste aparelho e sincronizado com a conta de ${esc(auth.user.nome)}.` : 'Seu progresso é salvo automaticamente neste aparelho. Entre para sincronizá-lo com outros dispositivos, ou use <a href="#/desempenho">Exportar progresso</a> para guardar uma cópia.'}
  </div>`;
}

/* ================= Edital ================= */
function viewEdital() {
  return `
  <div class="page-head">
    <div class="crumb">Concurso</div>
    <h1 class="page-title">Edital e prova</h1>
    <p class="page-lead">Resumo das regras que interessam ao cargo de Assistente Social Educacional e texto do conteúdo programático específico, com o tópico correspondente nesta plataforma.</p>
  </div>
  <div class="note warn"><b>Acompanhe as retificações.</b> Em junho de 2026, decisão judicial determinou ajustes nos editais (inclusive conteúdo de Geografia de Campina Grande e regras de cotas), conforme <a href="${ED.links.decisao}" target="_blank" rel="noopener">noticiado na imprensa local</a>. A <a href="${ED.links.retif5}" target="_blank" rel="noopener">Retificação nº 05/2026</a> atualizou vagas e cronograma; confira sempre a versão mais recente no site da IDECAN.</div>

  <div class="cols-2">
    <section class="panel">
      <div class="panel-head"><h2>Ficha do concurso</h2></div>
      <table class="tbl"><tbody>${ED.ficha.map(f => `<tr><td class="k">${f[0]}</td><td>${esc(f[1])}</td></tr>`).join('')}</tbody></table>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Cronograma</h2><span class="xs">Retificação nº 05/2026</span></div>
      <table class="tbl"><tbody>${ED.cronograma.map(c => `<tr class="${c[0] === '10/01/2027' ? 'hl' : ''}"><td class="k tnum">${c[0]}</td><td>${esc(c[1])}</td></tr>`).join('')}</tbody></table>
    </section>
  </div>

  <section class="panel" style="margin-top:var(--space-5)">
    <div class="panel-head"><h2>Prova objetiva — nível superior (item 10.1.2)</h2></div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Área</th><th>Disciplina</th><th class="num">Questões</th><th class="num">Peso</th><th class="num">Máximo</th><th class="hide-sm">Nesta plataforma</th></tr></thead>
      <tbody>${ED.composicao.map(c => `<tr><td class="muted">${c[0]}</td><td>${c[1]}</td><td class="num">${String(c[2]).padStart(2, '0')}</td><td class="num">${c[3]}</td><td class="num">${c[4]}</td><td class="hide-sm">${c[5] ? (c[0] === 'Conhecimentos Específicos' ? 'Tópicos 01 a 07' : 'Tópico 08') : '<span class="faint">Não incluído</span>'}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="num">40</td><td class="num"></td><td class="num">60,00</td><td class="hide-sm"></td></tr></tfoot>
    </table></div>
    <div class="panel-body small muted" style="border-top:1px solid var(--color-divider)">
      * O quadro do edital indica peso "3,00" para História de Campina Grande, mas pontuação máxima de 3,00 para 3 questões — o que corresponde a peso 1,00. A soma das linhas do quadro também resulta em 41 questões, enquanto o item 10.2 fixa 40. São inconsistências do próprio edital; acompanhe eventual retificação.
    </div>
  </section>

  <div class="cols-2" style="margin-top:var(--space-5)">
    <section class="panel">
      <div class="panel-head"><h2>Critérios de aprovação</h2></div>
      <div class="panel-body"><ul class="list">${ED.criterios.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Desempate (item 13.3)</h2></div>
      <div class="panel-body"><ol class="list">${ED.desempate.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>
    </section>
  </div>

  <section class="panel" style="margin-top:var(--space-5)">
    <div class="panel-head"><h2>Prova de títulos (item 12.4)</h2><span class="xs">Classificatória · até 10 pontos</span></div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Título</th><th class="num">Por título</th><th class="num">Máximo</th></tr></thead>
      <tbody>${ED.titulos.slice(0, -1).map(t => `<tr><td>${esc(t[0])}</td><td class="num">${t[1]}</td><td class="num">${t[2]}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="num">10,00</td></tr></tfoot>
    </table></div>
    <div class="panel-body small muted" style="border-top:1px solid var(--color-divider)">Serão convocados para os títulos os candidatos aprovados na objetiva até a 38ª posição na ampla concorrência, 6ª entre PcD e 38ª entre pessoas negras.</div>
  </section>

  <section class="panel" style="margin-top:var(--space-5)">
    <div class="panel-head"><h2>Conhecimentos específicos — texto do edital</h2><span class="xs">Anexo II · Assistente Social Educacional</span></div>
    ${ED.conteudo.map((c, i) => `<div class="ed-item"><span class="ed-n">${String(i + 1).padStart(2, '0')}</span><div><p class="ed-text">${esc(c[0])}</p><div class="ed-links">${c[1].map(id => `<a href="#/topico/${id}">${TMAP[id].num} · ${esc(TMAP[id].title)}</a>`).join('')}</div></div></div>`).join('')}
  </section>

  <section class="panel" style="margin-top:var(--space-5)">
    <div class="panel-head"><h2>Conhecimentos gerais</h2></div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Disciplina</th><th>Conteúdo</th><th>Cobertura</th></tr></thead>
      <tbody>${ED.gerais.map(g => `<tr><td style="white-space:nowrap">${g[0]}</td><td class="small">${esc(g[1])}</td><td class="small">${esc(g[2])}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>
  ${footerNote()}`;
}

/* ================= Tópico ================= */
let bankFilter = { a: 'all', status: 'all', dif: 'all' };
let bankAnswers = {};
let bankReveal = {}; // questões respondidas cujo gabarito já foi aberto
const isPending = qid => bankAnswers[qid] !== undefined && !bankReveal[qid];

function viewTopic(t, tabRaw) {
  const [tab, qs] = tabRaw.split('?');
  if (viewTopic.last !== t.id) { bankFilter = { a: 'all', status: 'all', dif: 'all' }; viewTopic.last = t.id; }
  let jump = null;
  if (qs) { const p = new URLSearchParams(qs); if (p.get('a')) bankFilter = { a: p.get('a'), status: 'all', dif: 'all' }; jump = p.get('s'); try { history.replaceState(null, '', '#/topico/' + t.id + '/' + tab); } catch (e) {} }
  if (jump) setTimeout(() => { const i = t.sections.findIndex(s => s.assunto === jump); const el = document.getElementById('sec-' + i); if (el) el.scrollIntoView({ block: 'start' }); }, 30);
  const s = topicStats(t.id);
  const items = ED.conteudo.map((c, i) => ({ c, i })).filter(x => x.c[1].includes(t.id));
  return `
  <div class="page-head">
    <div class="crumb">Conteúdo programático · Tópico ${t.num}</div>
    <h1 class="page-title">${esc(t.title)}</h1>
    <p class="page-lead">${esc(t.short)}</p>
    ${items.length ? `<details style="margin-top:var(--space-3)"><summary class="small" style="cursor:pointer;color:var(--color-link)">Itens do edital cobertos (${items.length})</summary>
      <div class="small muted" style="margin-top:var(--space-2);max-width:80ch">${items.map(x => `<p><span class="tnum faint">${String(x.i + 1).padStart(2, '0')}</span> ${esc(x.c[0])}</p>`).join('')}</div></details>` : ''}
  </div>
  <div class="tabs" role="tablist">
    <a class="tab ${tab === 'resumo' ? 'active' : ''}" href="#/topico/${t.id}/resumo" role="tab">Resumos<span class="cnt">${t.sections.length}</span></a>
    <a class="tab ${tab === 'questoes' ? 'active' : ''}" href="#/topico/${t.id}/questoes" role="tab">Questões comentadas<span class="cnt">${s.total}</span></a>
    <a class="tab ${tab === 'desempenho' ? 'active' : ''}" href="#/topico/${t.id}/desempenho" role="tab">Desempenho</a>
  </div>
  ${tab === 'questoes' ? viewBank(t) : tab === 'desempenho' ? viewTopicStats(t) : viewSummary(t)}
  ${footerNote()}`;
}

function viewSummary(t) {
  return `<div class="summary-layout">
    <nav class="toc" aria-label="Seções">
      <div class="toc-title">Neste tópico</div>
      ${t.sections.map((sec, i) => `<a href="javascript:void(0)" data-action="goto" data-target="sec-${i}"><span class="ck">${state.read[t.id + ':' + sec.assunto] ? '✓' : ''}</span><span>${esc(ANAME[t.id + ':' + sec.assunto])}</span></a>`).join('')}
    </nav>
    <div class="doc">
      ${t.sections.map((sec, i) => {
        const key = t.id + ':' + sec.assunto; const isRead = !!state.read[key];
        const qn = QS.filter(q => q.t === t.id && q.a === sec.assunto).length;
        return `<article class="doc-sec" id="sec-${i}">
          <div class="doc-kicker"><span><span class="n">${t.num}.${i + 1}</span> · ${esc(ANAME[key])}</span>${isRead ? '<span class="tag ok">Lido</span>' : ''}</div>
          <h3>${esc(sec.title)}</h3>
          ${sec.html.replace(/<table/g, '<div class="table-wrap"><table').replace(/<\/table>/g, '</table></div>')}
          <div class="doc-foot">
            <button class="btn btn-sm ${isRead ? '' : 'btn-primary'}" data-action="toggle-read" data-key="${key}">${isRead ? 'Desmarcar leitura' : 'Marcar como lido'}</button>
            <a class="btn btn-sm" href="#/topico/${t.id}/questoes?a=${sec.assunto}">Resolver ${qn} ${qn === 1 ? 'questão' : 'questões'} deste assunto</a>
          </div>
        </article>`;
      }).join('')}
    </div>
  </div>`;
}

function filteredBank(t) {
  return QS.filter(q => {
    if (q.t !== t.id) return false;
    if (bankFilter.a !== 'all' && q.a !== bankFilter.a) return false;
    if (bankFilter.dif !== 'all' && String(q.dif) !== bankFilter.dif) return false;
    const at = state.attempts[q.id];
    if (bankFilter.status === 'new' && at) return false;
    if (bankFilter.status === 'wrong' && !(at && at.last === false)) return false;
    if (bankFilter.status === 'right' && !(at && at.last === true)) return false;
    return true;
  });
}

function viewBank(t) {
  const list = filteredBank(t);
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  const st = topicStats(t.id);
  const all = QS.filter(q => q.t === t.id);
  const dist = [1, 2, 3].map(d => all.filter(q => q.dif === d).length);
  return `
  <div class="bank-sum">
    <div><span class="xs muted">Resolvidas</span> <b class="tnum">${st.seen}</b><span class="xs muted"> de ${st.total}</span></div>
    <div><span class="xs muted">Aproveitamento</span> <b class="tnum">${st.n ? st.p + '%' : '—'}</b></div>
    <div class="hide-sm"><span class="xs muted">Fácil / média / difícil</span> <b class="tnum">${dist.join(' / ')}</b></div>
    <div class="bank-bar"><div class="bar ${st.n ? lvl(st.p) : ''}"><span style="width:${pct(st.seen, st.total)}%"></span></div></div>
    ${(() => { const k = all.filter(q => isPending(q.id)).length; return k ? `<button class="btn btn-sm btn-primary" data-action="bank-reveal-all" data-t="${t.id}">Corrigir ${k} ${k === 1 ? 'respondida' : 'respondidas'}</button>` : ''; })()}
  </div>
  <div class="filters">
    <label class="sr-only" for="f-a">Assunto</label>
    <select class="select" id="f-a" data-filter="a">${opt('all', 'Todos os assuntos', bankFilter.a)}${t.assuntos.map(a => opt(a.id, a.name, bankFilter.a)).join('')}</select>
    <label class="sr-only" for="f-dif">Dificuldade</label>
    <select class="select" id="f-dif" data-filter="dif">${opt('all', 'Qualquer dificuldade', bankFilter.dif)}${opt('1', 'Fácil', bankFilter.dif)}${opt('2', 'Média', bankFilter.dif)}${opt('3', 'Difícil', bankFilter.dif)}</select>
    <label class="sr-only" for="f-status">Situação</label>
    <select class="select" id="f-status" data-filter="status">${opt('all', 'Todas as situações', bankFilter.status)}${opt('new', 'Não resolvidas', bankFilter.status)}${opt('wrong', 'Errei na última', bankFilter.status)}${opt('right', 'Acertei na última', bankFilter.status)}</select>
    <span class="xs muted" style="margin-left:auto">${list.length} ${list.length === 1 ? 'questão' : 'questões'}</span>
  </div>
  ${list.length ? `<div class="q-list">${list.map((q, i) => qCard(q, i + 1)).join('')}</div>` :
    `<div class="panel empty"><h3>Nenhuma questão com esses filtros</h3><p>Altere o assunto, a dificuldade ou a situação.</p><button class="btn btn-sm" data-action="clear-filters">Limpar filtros</button></div>`}`;
}

function stemHTML(q) {
  const parts = q.q.split('\n\n');
  if (parts.length < 2) return `<p class="q-text">${esc(q.q)}</p>`;
  const intro = parts.shift();
  const lines = parts.join('\n').split('\n');
  const items = [], tail = [];
  lines.forEach(l => { const m = l.match(/^(I{1,3}|IV|V)\.\s+(.*)$/); if (m) items.push(m); else if (l.trim()) tail.push(l); });
  return `<p class="q-text">${esc(intro)}</p>
    ${items.length ? `<ol class="q-items">${items.map(m => `<li><span class="q-roman">${m[1]}</span><span>${esc(m[2])}</span></li>`).join('')}</ol>` : ''}
    ${tail.length ? `<p class="q-text">${esc(tail.join(' '))}</p>` : ''}`;
}

function qMeta(q, num) {
  const at = state.attempts[q.id];
  return `<div class="q-meta">
    ${num !== undefined ? `<span class="q-num">Questão ${String(num).padStart(2, '0')}</span>` : ''}
    ${parseRoute()[0] === 'questoes' ? `<span class="faint tnum">${TMAP[q.t].num}</span>` : ''}<span>${esc(ANAME[q.t + ':' + q.a])}</span><span class="sep">·</span><span>${difLabel(q.dif)}</span>
    ${isPending(q.id) ? '<span class="right tag primary">Respondida</span>' : at ? `<span class="right tag ${at.last ? 'ok' : 'bad'}">${at.ok}/${at.n} acertos</span>` : ''}
  </div>`;
}

/* Tesourinha: eliminar alternativas (fica só na memória da sessão) */
let cuts = {};
const isCut = (qid, i) => !!(cuts[qid] && cuts[qid].includes(i));
function toggleCut(qid, i) { const a = cuts[qid] || (cuts[qid] = []); const k = a.indexOf(i); if (k > -1) a.splice(k, 1); else a.push(i); return k === -1; }
const SCISSORS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>';
function optionsHTML(q, chosen, reveal, ctx) {
  const canCut = !reveal && ctx !== 'noop';
  return `<div class="opts ${canCut ? 'can-cut' : ''}" role="group" aria-label="Alternativas">
    ${q.o.map((o, i) => {
      let cls = '';
      const cut = isCut(q.id, i);
      if (reveal) { if (i === q.c) cls = 'correct'; else if (i === chosen) cls = 'wrong'; }
      else if (i === chosen) cls = 'selected';
      if (cut) cls += ' cut';
      const btn = `<button class="opt ${cls}" data-action="${ctx}" data-q="${q.id}" data-i="${i}" ${reveal && ctx === 'bank-answer' ? 'disabled' : ''} aria-pressed="${i === chosen}"${cut && !reveal ? ' title="Alternativa eliminada. Clique para restaurar."' : ''}><span class="opt-letter">${LETTERS[i]}</span><span class="opt-txt">${esc(o)}</span></button>`;
      if (!canCut) return `<div class="opt-row">${btn}</div>`;
      return `<div class="opt-row"><button class="cut-btn ${cut ? 'on' : ''}" data-action="cut" data-q="${q.id}" data-i="${i}" data-ctx="${ctx}" aria-pressed="${cut}" aria-label="${cut ? 'Restaurar' : 'Eliminar'} alternativa ${LETTERS[i]}" title="${cut ? 'Restaurar' : 'Eliminar'} alternativa">${SCISSORS}</button>${btn}</div>`;
    }).join('')}
  </div>`;
}

function commentHTML(q, chosen) {
  const blank = chosen === undefined || chosen === null;
  const ok = chosen === q.c;
  return `<div class="comment">
    <div class="comment-head ${blank ? '' : ok ? 'ok' : 'bad'}">${blank ? 'Em branco' : ok ? 'Resposta correta' : 'Resposta incorreta'} — gabarito: ${LETTERS[q.c]}</div>
    <p style="margin:0">${esc(q.com)}</p>
    <p class="ref-line">Fundamento: ${esc(q.ref)}</p>
  </div>`;
}

function qCard(q, num) {
  const chosen = bankAnswers[q.id];
  const answered = chosen !== undefined;
  const reveal = answered && !!bankReveal[q.id];
  let opts;
  if (answered && !reveal) opts = optionsHTML(q, chosen, false, 'noop').replace(/<button class="opt /g, '<button disabled class="opt ');
  else opts = optionsHTML(q, chosen, reveal, 'bank-answer');
  return `<article class="q-card ${answered && !reveal ? 'is-answered' : ''}" id="q-${q.id}">
    ${qMeta(q, num)}
    ${stemHTML(q)}
    ${opts}
    ${answered && !reveal ? `<div class="q-answered"><span class="small"><b>Resposta registrada: ${LETTERS[chosen]}.</b> <span class="muted">O gabarito fica oculto até você pedir.</span></span><button class="btn btn-sm" data-action="bank-reveal" data-q="${q.id}">Ver resposta e comentário</button></div>` : ''}
    ${reveal ? commentHTML(q, chosen) + `<div class="q-actions"><button class="btn btn-sm" data-action="bank-retry" data-q="${q.id}">Responder novamente</button></div>` : ''}
  </article>`;
}


/* ===== Resolver questões (prática livre, separada do simulado) ===== */
const QZ_BLANK = () => ({ t: 'all', a: 'all', dif: 'all', status: 'all', fmt: 'all', busca: '' });
let qz = QZ_BLANK();
let qzOpt = { modo: 'lista', ordem: 'edital' };
let qzIdx = 0, qzPage = 0, qzRand = {}, qzOpen = false;
const qzActive = () => ['t', 'a', 'dif', 'status', 'fmt'].filter(k => qz[k] !== 'all').length + (qz.busca.trim() ? 1 : 0);
const QZ_STEP = 20;
let qzShown = QZ_STEP;
const TORDER = Object.fromEntries(TOPICS.map((t, i) => [t.id, i]));
function qFormat(q) { if (/\n\nI\.\s/.test(q.q)) return 'af'; if (/INCORRETA|\bNÃO\b|EXCETO/.test(q.q)) return 'inc'; return 'dir'; }
const FMT_LABEL = { af: 'Análise de afirmativas', inc: 'Incorreta / exceto', dir: 'Direta' };
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function qzList() {
  const b = norm(qz.busca.trim());
  const list = QS.filter(q => {
    if (qz.t !== 'all' && q.t !== qz.t) return false;
    if (qz.a !== 'all' && q.a !== qz.a) return false;
    if (qz.dif !== 'all' && String(q.dif) !== qz.dif) return false;
    if (qz.fmt !== 'all' && qFormat(q) !== qz.fmt) return false;
    const at = state.attempts[q.id];
    if (qz.status === 'new' && at) return false;
    if (qz.status === 'wrong' && !(at && at.last === false)) return false;
    if (qz.status === 'right' && !(at && at.last === true)) return false;
    if (b && !norm(q.q + ' ' + q.o.join(' ') + ' ' + (ANAME[q.t + ':' + q.a] || '')).includes(b)) return false;
    return true;
  });
  if (qzOpt.ordem === 'aleatoria') list.sort((x, y) => (qzRand[x.id] || 0) - (qzRand[y.id] || 0));
  else list.sort((x, y) => (TORDER[x.t] - TORDER[y.t]) || (TMAP[x.t].assuntos.findIndex(a => a.id === x.a) - TMAP[y.t].assuntos.findIndex(a => a.id === y.a)));
  return list;
}
function qzShuffle() { qzRand = Object.fromEntries(QS.map(q => [q.id, Math.random()])); }
function qzResetPos() { qzIdx = 0; qzPage = 0; qzShown = QZ_STEP; }

function viewPractice() {
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  const tSel = qz.t !== 'all' ? TMAP[qz.t] : null;
  const counts = { af: 0, inc: 0, dir: 0 }; QS.forEach(q => counts[qFormat(q)]++);
  return `
  <div class="page-head">
    <div class="crumb">Prática</div>
    <h1 class="page-title">Resolver questões</h1>
    <p class="page-lead">Banco completo com ${QS.length} questões comentadas de todos os tópicos do edital. Responda no seu ritmo, sem cronômetro. Ao marcar uma alternativa, a questão fica registrada como respondida e o gabarito só aparece quando você pedir.</p>
  </div>
  <section class="panel qz-filters ${qzOpen ? 'open' : ''}">
    <div class="panel-body">
      <button class="btn btn-sm qz-toggle" data-action="qz-toggle" aria-expanded="${qzOpen}"><i data-lucide="sliders-horizontal"></i>${qzOpen ? 'Ocultar filtros' : 'Filtros'}${qzActive() ? ` <span class="tag primary">${qzActive()} ativo${qzActive() > 1 ? 's' : ''}</span>` : ''}</button>
      <div class="qz-grid">
        <div class="fg"><label for="qz-t">Tópico</label><select class="select" id="qz-t" data-qz="t">${opt('all', 'Todos os tópicos', qz.t)}${TOPICS.map(t => opt(t.id, t.num + ' · ' + esc(t.title), qz.t)).join('')}</select></div>
        <div class="fg"><label for="qz-a">Assunto</label><select class="select" id="qz-a" data-qz="a" ${tSel ? '' : 'disabled'}>${opt('all', tSel ? 'Todos os assuntos' : 'Escolha um tópico', qz.a)}${tSel ? tSel.assuntos.map(a => opt(a.id, esc(a.name), qz.a)).join('') : ''}</select></div>
        <div class="fg"><label for="qz-dif">Dificuldade</label><select class="select" id="qz-dif" data-qz="dif">${opt('all', 'Qualquer', qz.dif)}${opt('1', 'Fácil', qz.dif)}${opt('2', 'Média', qz.dif)}${opt('3', 'Difícil', qz.dif)}</select></div>
        <div class="fg"><label for="qz-status">Situação</label><select class="select" id="qz-status" data-qz="status">${opt('all', 'Todas', qz.status)}${opt('new', 'Não resolvidas', qz.status)}${opt('wrong', 'Errei na última', qz.status)}${opt('right', 'Acertei na última', qz.status)}</select></div>
        <div class="fg"><label for="qz-fmt">Formato</label><select class="select" id="qz-fmt" data-qz="fmt">${opt('all', 'Todos', qz.fmt)}${opt('dir', 'Direta (' + counts.dir + ')', qz.fmt)}${opt('af', 'Afirmativas I a IV (' + counts.af + ')', qz.fmt)}${opt('inc', 'Incorreta / exceto (' + counts.inc + ')', qz.fmt)}</select></div>
        <div class="fg qz-search"><label for="qz-busca">Buscar no enunciado</label><input class="input" id="qz-busca" type="search" placeholder="Ex.: Conselho Tutelar, BPC, sigilo" value="${esc(qz.busca)}" autocomplete="off"></div>
      </div>
      <div class="qz-bar">
        <div class="seg" role="group" aria-label="Modo de exibição">
          <button class="${qzOpt.modo === 'lista' ? 'on' : ''}" data-action="qz-modo" data-v="lista" aria-pressed="${qzOpt.modo === 'lista'}">Uma abaixo da outra</button>
          <button class="${qzOpt.modo === 'uma' ? 'on' : ''}" data-action="qz-modo" data-v="uma" aria-pressed="${qzOpt.modo === 'uma'}">Uma por vez</button>
        </div>
        <div class="seg" role="group" aria-label="Ordem">
          <button class="${qzOpt.ordem === 'edital' ? 'on' : ''}" data-action="qz-ordem" data-v="edital" aria-pressed="${qzOpt.ordem === 'edital'}">Ordem do edital</button>
          <button class="${qzOpt.ordem === 'aleatoria' ? 'on' : ''}" data-action="qz-ordem" data-v="aleatoria" aria-pressed="${qzOpt.ordem === 'aleatoria'}">Embaralhar</button>
        </div>
        <button class="btn btn-sm btn-ghost" data-action="qz-clear">Limpar filtros</button>
      </div>
    </div>
  </section>
  <div id="qz-results">${qzResultsHTML()}</div>
  ${footerNote()}`;
}

function qzSumHTML(list) {
  const ids = new Set(list.map(q => q.id));
  const st = statsFor(q => ids.has(q.id));
  const sess = list.filter(q => bankAnswers[q.id] !== undefined);
  const pend = sess.filter(q => !bankReveal[q.id]).length;
  return `<div class="bank-sum" id="qz-sum">
    <div><span class="xs muted">No filtro</span> <b class="tnum">${list.length}</b><span class="xs muted"> ${list.length === 1 ? 'questão' : 'questões'}</span></div>
    <div><span class="xs muted">Respondidas agora</span> <b class="tnum">${sess.length}</b></div>
    <div class="hide-sm"><span class="xs muted">Aproveitamento corrigido</span> <b class="tnum">${st.n ? st.p + '%' : '—'}</b></div>
    <div class="bank-bar"><div class="bar ${st.n ? lvl(st.p) : ''}"><span style="width:${pct(st.seen, list.length)}%"></span></div></div>
    ${pend ? `<button class="btn btn-sm btn-primary" data-action="qz-reveal-all">Corrigir ${pend} ${pend === 1 ? 'respondida' : 'respondidas'}</button>` : ''}
  </div>`;
}
function qzResultsHTML() {
  const list = qzList();
  const sum = qzSumHTML(list);
  if (!list.length) return sum + `<div class="panel empty"><h3>Nenhuma questão com esses filtros</h3><p>Altere o tópico, a situação ou o termo de busca.</p><button class="btn btn-sm" data-action="qz-clear">Limpar filtros</button></div>`;
  if (qzOpt.modo === 'uma') {
    if (qzIdx >= list.length) qzIdx = list.length - 1;
    const q = list[qzIdx];
    const answered = bankAnswers[q.id] !== undefined;
    const nextNew = list.findIndex((x, i) => i > qzIdx && bankAnswers[x.id] === undefined && !state.attempts[x.id]);
    return sum + `
    <div class="qz-nav">
      <button class="btn btn-sm" data-action="qz-prev" ${qzIdx === 0 ? 'disabled' : ''}><i data-lucide="chevron-left"></i>Anterior</button>
      <div class="qz-pos"><span class="tnum"><b>${qzIdx + 1}</b> de ${list.length}</span><span class="xs muted hide-sm">${esc(TMAP[q.t].num + ' · ' + TMAP[q.t].title)}</span></div>
      <button class="btn btn-sm ${answered ? 'btn-primary' : ''}" data-action="qz-next" ${qzIdx >= list.length - 1 ? 'disabled' : ''}>Próxima<i data-lucide="chevron-right"></i></button>
    </div>
    <div class="q-list">${qCard(q, qzIdx + 1)}</div>
    <div class="qz-foot">
      <span class="xs muted">Atalhos: A, B, C ou D para responder · setas para navegar · use a tesoura ao lado de cada alternativa para eliminá-la</span>
      ${nextNew > -1 ? `<button class="btn btn-sm btn-ghost" data-action="qz-go" data-i="${nextNew}">Pular para a próxima não resolvida</button>` : ''}
    </div>`;
  }
  const shown = list.slice(0, qzShown);
  const rest = list.length - shown.length;
  return sum + `<div class="q-list">${shown.map((q, i) => qCard(q, i + 1)).join('')}</div>` +
    (rest > 0 ? `<div class="qz-more"><button class="btn" data-action="qz-more">Mostrar mais ${Math.min(QZ_STEP, rest)} questões</button><span class="xs muted">${shown.length} de ${list.length} exibidas</span></div>` : `<div class="qz-more"><span class="xs muted">Fim da lista · ${list.length} ${list.length === 1 ? 'questão' : 'questões'}</span></div>`);
}
function qzSumRefresh() { const el = document.getElementById('qz-sum'); if (el) { const t = document.createElement('div'); t.innerHTML = qzSumHTML(qzList()); el.replaceWith(t.firstElementChild); } }
function qzRefresh(scrollTop) {
  const el = document.getElementById('qz-results'); if (!el) return;
  el.innerHTML = qzResultsHTML(); icons();
  if (scrollTop) { const y = el.getBoundingClientRect().top + window.scrollY - 80; if (window.scrollY > y) window.scrollTo(0, y); }
}

function viewTopicStats(t) {
  const s = topicStats(t.id);
  return `<div class="strip">
    <div><div class="strip-label">Resolvidas</div><div class="strip-value">${s.seen}<small> / ${s.total}</small></div></div>
    <div><div class="strip-label">Tentativas</div><div class="strip-value">${s.n}</div></div>
    <div><div class="strip-label">Acertos</div><div class="strip-value">${s.ok}</div></div>
    <div><div class="strip-label">Aproveitamento</div><div class="strip-value">${s.n ? s.p + '%' : '—'}</div></div>
  </div>
  <section class="panel">${assuntoTable([t])}</section>
  <div class="btn-row" style="margin-top:var(--space-5)"><button class="btn btn-primary" data-action="topic-sim" data-t="${t.id}">Simulado com todas as questões deste tópico</button></div>`;
}

function assuntoTable(topics, showTopicRows) {
  return `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>Assunto</th><th class="bar-cell">Aproveitamento</th><th class="num">Acertos</th><th class="num">%</th></tr></thead>
    <tbody>${topics.map(t => {
      const ts = topicStats(t.id);
      const head = showTopicRows ? `<tr class="group"><td>${t.num} · ${esc(t.title)}</td><td class="bar-cell mid">${barCell(ts)}</td><td class="num">${ts.ok}/${ts.n}</td><td class="num">${pctCell(ts)}</td></tr>` : '';
      return head + t.assuntos.map(a => {
        const s = assuntoStats(t.id, a.id);
        return `<tr><td>${esc(a.name)}<div class="xs muted">${s.seen}/${s.total} resolvidas</div></td><td class="bar-cell mid">${barCell(s)}</td><td class="num">${s.ok}/${s.n}</td><td class="num">${pctCell(s)}</td></tr>`;
      }).join('');
    }).join('')}</tbody></table></div>`;
}

/* ================= Simulador: configuração ================= */
const ESPEC = TOPICS.filter(t => t.id !== 'gerais').map(t => t.id);
function selFor(ids) { return Object.fromEntries(TOPICS.flatMap(t => t.assuntos.map(a => [t.id + ':' + a.id, ids.includes(t.id)]))); }
const PRESETS = {
  prova: { label: 'Formato da prova', desc: '20 questões de conhecimentos específicos · 90 min · gabarito ao final', n: 20, ids: ESPEC, mode: 'prova' },
  longo: { label: 'Simulado longo', desc: '40 questões de todo o conteúdo · 3 h · gabarito ao final', n: 40, ids: TOPICS.map(t => t.id), mode: 'prova' },
  livre: { label: 'Personalizado', desc: 'Escolha assuntos, quantidade, tempo e modo de correção', n: 10, ids: TOPICS.map(t => t.id), mode: 'treino' }
};
let cfg = { preset: 'prova', sel: selFor(ESPEC), n: 20, tempoAuto: true, minutos: 90, mode: 'prova', prior: 'mix' };
function applyPreset(p) { const P = PRESETS[p]; cfg = Object.assign(cfg, { preset: p, sel: selFor(P.ids), n: P.n, mode: P.mode, tempoAuto: true }); }
function poolFromCfg() { return QS.filter(q => cfg.sel[q.t + ':' + q.a]); }

function viewConfig() {
  const banner = exam && !exam.finished ? `<div class="note warn"><b>Simulado em andamento</b> — ${exam.qs.length} questões, ${fmtTime(exam.remaining)} restantes. <a href="#/simulado/prova">Continuar</a></div>` : '';
  const custom = cfg.preset === 'livre';
  return `
  <div class="page-head">
    <div class="crumb">Prática</div>
    <h1 class="page-title">Simulador de prova</h1>
    <p class="page-lead">Questões de múltipla escolha com quatro alternativas, como na prova da IDECAN. O tempo automático segue o ritmo da prova real: 3 horas para 40 questões (4,5 minutos por questão).</p>
  </div>
  ${banner}
  <div class="presets" role="radiogroup" aria-label="Tipo de simulado">
    ${Object.entries(PRESETS).map(([k, P]) => `<button type="button" role="radio" aria-checked="${cfg.preset === k}" class="preset ${cfg.preset === k ? 'on' : ''}" data-action="preset" data-p="${k}"><b>${P.label}</b><span>${P.desc}</span></button>`).join('')}
  </div>
  <div class="config-layout">
    <section class="panel">
      <div class="panel-head"><h2>Configuração</h2>${custom ? '' : '<span class="xs">Escolha "Personalizado" para alterar</span>'}</div>
      <div class="field">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap">
          <span class="field-label">Conteúdo</span>
          ${custom ? `<span class="btn-row"><button class="btn btn-sm" data-action="cfg-all" data-v="1">Marcar tudo</button><button class="btn btn-sm" data-action="cfg-all" data-v="0">Limpar</button></span>` : ''}
        </div>
        <fieldset ${custom ? '' : 'disabled'} style="border:0;padding:0;margin:0;min-width:0;${custom ? '' : 'opacity:.6'}">
        <div class="check-tree">
          ${TOPICS.map(t => {
            const keys = t.assuntos.map(a => t.id + ':' + a.id);
            const on = keys.filter(k => cfg.sel[k]).length;
            return `<div class="check-group">
              <label class="check"><input type="checkbox" data-cfg-topic="${t.id}" ${on === keys.length ? 'checked' : ''} ${on > 0 && on < keys.length ? 'data-indet="1"' : ''}><span>${t.num} · ${esc(t.title)}</span></label>
              <div class="check-sub">${t.assuntos.map(a => {
                const k = t.id + ':' + a.id; const c = QS.filter(q => q.t === t.id && q.a === a.id).length;
                return `<label class="check"><input type="checkbox" data-cfg-key="${k}" ${cfg.sel[k] ? 'checked' : ''}><span>${esc(a.name)} <span class="count">${c}</span></span></label>`;
              }).join('')}</div>
            </div>`;
          }).join('')}
        </div>
        </fieldset>
      </div>
      ${custom ? `
      <div class="field">
        <label class="field-label" for="cfg-n">Quantidade de questões</label>
        <div class="range-row"><input type="range" id="cfg-n" min="5" max="${QS.length}" step="1" value="${cfg.n}"><span class="range-val" id="cfg-n-val">${cfg.n}</span></div>
        <span class="field-help" id="cfg-n-help"></span>
      </div>
      <div class="field">
        <span class="field-label">Tempo</span>
        <div class="seg" data-seg="tempoAuto">${[['1', 'Ritmo da prova (4,5 min/questão)'], ['0', 'Definir minutos']].map(([v, l]) => `<button type="button" data-v="${v}" class="${String(+cfg.tempoAuto) === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="range-row" id="cfg-min-row" style="${cfg.tempoAuto ? 'display:none' : ''}"><input type="range" id="cfg-min" min="5" max="240" step="5" value="${cfg.minutos}" aria-label="Minutos"><span class="range-val" id="cfg-min-val">${cfg.minutos}</span><span class="xs muted">min</span></div>
      </div>
      <div class="field">
        <span class="field-label">Correção</span>
        <div class="seg" data-seg="mode">${[['prova', 'Ao final'], ['treino', 'Imediata, questão a questão']].map(([v, l]) => `<button type="button" data-v="${v}" class="${cfg.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>` : ''}
      <div class="field">
        <span class="field-label">Seleção das questões</span>
        <div class="seg" data-seg="prior">${[['mix', 'Aleatória'], ['new', 'Priorizar inéditas'], ['wrong', 'Priorizar erradas']].map(([v, l]) => `<button type="button" data-v="${v}" class="${cfg.prior === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
    </section>
    <aside class="panel summary-box">
      <div class="panel-head"><h2>Resumo</h2></div>
      <div id="cfg-summary"></div>
      <div class="panel-body" style="border-top:1px solid var(--color-divider)">
        <button class="btn btn-primary" style="width:100%" data-action="start-sim" id="start-btn">Iniciar simulado</button>
        <p class="xs muted" style="margin:var(--space-3) 0 0">Cronômetro regressivo com entrega automática ao zerar. Teclas A a D marcam a alternativa; setas navegam entre questões.</p>
      </div>
    </aside>
  </div>`;
}

function updateConfigSummary() {
  document.querySelectorAll('[data-indet]').forEach(el => { el.indeterminate = true; });
  const pool = poolFromCfg();
  const n = Math.min(cfg.n, pool.length);
  const secs = cfg.tempoAuto ? n * SEC_PER_Q : cfg.minutos * 60;
  const el = $('#cfg-summary'); if (!el) return;
  const nTopics = new Set(pool.map(q => q.t)).size;
  el.innerHTML = `<table class="tbl"><tbody>
    <tr><td class="k">Questões disponíveis</td><td class="num">${pool.length}</td></tr>
    <tr><td class="k">Questões no simulado</td><td class="num">${n}</td></tr>
    <tr><td class="k">Tópicos</td><td class="num">${nTopics}</td></tr>
    <tr><td class="k">Tempo</td><td class="num">${fmtDur(secs)}</td></tr>
    <tr><td class="k">Correção</td><td class="num">${cfg.mode === 'prova' ? 'Ao final' : 'Imediata'}</td></tr>
  </tbody></table>`;
  const help = $('#cfg-n-help');
  if (help) help.textContent = pool.length < cfg.n ? `A seleção tem ${pool.length} questões; o simulado usará todas.` : `${pool.length} questões disponíveis na seleção.`;
  const b = $('#start-btn'); if (b) b.disabled = pool.length === 0;
}

/* ================= Simulador: execução ================= */
let exam = null;
let timerId = null;

function restoreLocalProgress() {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const data = saved && saved.app === 'caderno-ss' && saved.data;
    if (!data || !data.attempts) return false;
    localProgressOwnerId = typeof saved.ownerId === 'string' ? saved.ownerId : null;
    importCode(JSON.stringify({ data }));

    const validAnswers = source => Object.fromEntries(Object.entries(source || {}).filter(([qid, answer]) =>
      !!QMAP[qid] && Number.isInteger(Number(answer)) && Number(answer) >= 0 && Number(answer) < LETTERS.length
    ).map(([qid, answer]) => [qid, Number(answer)]));
    bankAnswers = validAnswers(data.bankAnswers);
    bankReveal = Object.fromEntries(Object.entries(data.bankReveal || {}).filter(([qid, revealed]) =>
      !!QMAP[qid] && bankAnswers[qid] !== undefined && revealed === true
    ));

    const candidate = data.exam;
    if (candidate && Array.isArray(candidate.qs) && candidate.qs.length && candidate.qs.every(qid => !!QMAP[qid]) &&
        candidate.answers && Number.isFinite(candidate.total) && Number.isFinite(candidate.remaining)) {
      const validPositions = (source, predicate) => Object.fromEntries(Object.entries(source || {}).filter(([key, value]) =>
        Number.isInteger(Number(key)) && Number(key) >= 0 && Number(key) < candidate.qs.length && predicate(value)
      ).map(([key, value]) => [Number(key), value]));
      exam = {
        id: String(candidate.id || ('s' + Date.now())), qs: candidate.qs,
        answers: validPositions(candidate.answers, value => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < LETTERS.length),
        flags: validPositions(candidate.flags, value => typeof value === 'boolean'),
        checked: validPositions(candidate.checked, value => typeof value === 'boolean'),
        idx: Math.min(candidate.qs.length - 1, Math.max(0, Math.floor(Number(candidate.idx) || 0))),
        mode: candidate.mode === 'treino' ? 'treino' : 'prova', preset: String(candidate.preset || 'livre'),
        total: Math.max(1, Number(candidate.total)), remaining: Math.max(0, Math.min(Number(candidate.remaining), Number(candidate.total))),
        paused: true, finished: false
      };
      runTimer();
      if (parseRoute()[0] !== 'simulado' || parseRoute()[1] !== 'prova') location.hash = '#/simulado/prova';
    } else exam = null;

    dirty = false;
    return true;
  } catch (e) {
    return false;
  }
}

function pickQuestions(pool, n, prior) {
  if (prior === 'mix') return shuffle(pool).slice(0, n);
  const score = q => { const a = state.attempts[q.id]; if (prior === 'new') return a ? 1 : 0; return a && a.last === false ? 0 : a ? 2 : 1; };
  const groups = {};
  shuffle(pool).forEach(q => { const s = score(q); (groups[s] = groups[s] || []).push(q); });
  return Object.keys(groups).sort().flatMap(k => groups[k]).slice(0, n);
}

function startExam(qids, opts) {
  const total = opts.tempoAuto ? qids.length * SEC_PER_Q : opts.minutos * 60;
  exam = { id: 's' + Date.now(), qs: qids, answers: {}, flags: {}, idx: 0, mode: opts.mode, preset: opts.preset || 'livre', total, remaining: total, paused: false, finished: false, checked: {} };
  persistLocalProgress();
  cuts = {};
  runTimer();
  location.hash = '#/simulado/prova';
  if (parseRoute()[1] === 'prova') router();
}

function runTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!exam || exam.finished || exam.paused) return;
    exam.remaining -= 1;
    updateTimerEl();
    if (exam.remaining % 5 === 0) persistLocalProgress();
    if (exam.remaining <= 0) { exam.remaining = 0; finishExam(true); }
  }, 1000);
}

function updateTimerEl() {
  const el = $('#timer'); if (!el || !exam) return;
  el.querySelector('span').textContent = fmtTime(exam.remaining);
  el.classList.toggle('warn', exam.remaining <= 600 && exam.remaining > 120);
  el.classList.toggle('danger', exam.remaining <= 120);
}

function viewExam() {
  const e = exam;
  const q = QMAP[e.qs[e.idx]];
  const answered = Object.keys(e.answers).length;
  const chosen = e.answers[e.idx];
  const reveal = e.mode === 'treino' && e.checked[e.idx];
  if (e.paused) return `${examBar(answered)}<div class="panel paused"><h2 class="h2">Simulado pausado</h2><p class="muted small">O cronômetro está parado e as questões ficam ocultas até você retomar.</p><button class="btn btn-primary" data-action="pause">Retomar</button></div>`;
  return `
  ${examBar(answered)}
  <div class="exam">
    <div>
      <article class="q-card">
        ${qMeta(q, e.idx + 1)}
        ${stemHTML(q)}
        ${optionsHTML(q, chosen, reveal, reveal ? 'noop' : 'exam-answer')}
        ${reveal ? commentHTML(q, chosen) : ''}
        <div class="q-actions">
          <button class="btn btn-sm ${e.flags[e.idx] ? 'btn-primary' : ''}" data-action="flag">${e.flags[e.idx] ? 'Marcada para revisão' : 'Marcar para revisão'}</button>
          ${chosen !== undefined && !reveal ? `<button class="btn btn-sm btn-ghost" data-action="clear-answer">Limpar resposta</button>` : ''}
          ${e.mode === 'treino' && chosen !== undefined && !reveal ? `<button class="btn btn-sm btn-primary" data-action="check">Corrigir</button>` : ''}
        </div>
      </article>
      <div class="exam-nav">
        <button class="btn" data-action="prev" ${e.idx === 0 ? 'disabled' : ''}><i data-lucide="chevron-left"></i>Anterior</button>
        ${e.idx < e.qs.length - 1 ? `<button class="btn btn-primary" data-action="next">Próxima<i data-lucide="chevron-right"></i></button>` : `<button class="btn btn-primary" data-action="finish">Entregar prova</button>`}
      </div>
    </div>
    <aside class="panel">
      <div class="panel-head"><h2>Cartão-resposta</h2><span class="xs tnum">${answered}/${e.qs.length}</span></div>
      <div class="panel-body">
        <div class="palette">${e.qs.map((qid, i) => {
          let cls = '';
          if (e.mode === 'treino' && e.checked[i]) cls = e.answers[i] === QMAP[qid].c ? 'correct' : 'wrong';
          else if (e.answers[i] !== undefined) cls = 'answered';
          return `<button class="pal ${cls} ${i === e.idx ? 'current' : ''} ${e.flags[i] ? 'flag' : ''}" data-action="jump" data-i="${i}" aria-label="Questão ${i + 1}${e.answers[i] !== undefined ? ', respondida ' + LETTERS[e.answers[i]] : ''}">${e.answers[i] !== undefined && e.mode === 'prova' ? LETTERS[e.answers[i]] : i + 1}</button>`;
        }).join('')}</div>
        <div class="legend">
          <span><i style="background:var(--color-primary-soft);border-color:var(--color-primary)"></i>Respondida (mostra a letra)</span>
          <span><i></i>Em branco</span>
          <span><i style="background:var(--color-warning);border-color:var(--color-warning)"></i>Marcada para revisão</span>
        </div>
        <button class="btn" style="width:100%;margin-top:var(--space-4)" data-action="finish">Entregar prova</button>
      </div>
    </aside>
  </div>`;
}

function examBar(answered) {
  const e = exam;
  return `<div class="exam-bar">
    <div id="timer" class="timer" aria-live="off"><i data-lucide="clock"></i><span>${fmtTime(e.remaining)}</span></div>
    <div class="exam-progress">${answered} de ${e.qs.length} respondidas · ${e.mode === 'prova' ? 'gabarito ao final' : 'correção imediata'}<div class="bar"><span style="width:${pct(answered, e.qs.length)}%"></span></div></div>
    <div class="btn-row">
      <button class="btn btn-sm" data-action="pause">${e.paused ? 'Retomar' : 'Pausar'}</button>
      <button class="btn btn-sm btn-ghost" data-action="abort">Desistir</button>
    </div>
  </div>`;
}

async function finishExam(auto) {
  const e = exam; if (!e || e.finished) return;
  if (!auto) {
    const blanks = e.qs.length - Object.keys(e.answers).length;
    const flagged = Object.values(e.flags).filter(Boolean).length;
    const ok = await modal({ title: 'Entregar a prova?', body: `${blanks ? `<b>${blanks}</b> ${blanks === 1 ? 'questão em branco' : 'questões em branco'}. ` : 'Todas as questões foram respondidas. '}${flagged ? `<b>${flagged}</b> marcada(s) para revisão. ` : ''}Depois da entrega, as respostas não podem ser alteradas.`, confirm: 'Entregar' });
    if (!ok) return;
  }
  e.finished = true; clearInterval(timerId);
  let acertos = 0, erros = 0, brancos = 0, pts = 0, ptsMax = 0, espOk = 0, espN = 0;
  const por = {};
  e.qs.forEach((qid, i) => {
    const q = QMAP[qid]; const k = q.t + ':' + q.a; por[k] = por[k] || { ok: 0, n: 0 };
    por[k].n++; ptsMax += peso(q);
    if (q.t !== 'gerais') espN++;
    const ans = e.answers[i];
    if (ans === undefined) { brancos++; return; }
    const ok = ans === q.c;
    if (ok) { acertos++; por[k].ok++; pts += peso(q); if (q.t !== 'gerais') espOk++; } else erros++;
    recordAttempt(qid, ok);
  });
  const rec = { id: e.id, date: Date.now(), n: e.qs.length, acertos, erros, brancos, pts, ptsMax, espOk, espN,
    score: pct(acertos, e.qs.length), used: e.total - e.remaining, total: e.total, mode: e.mode, preset: e.preset, por, qs: e.qs, answers: e.answers, auto: !!auto };
  state.sims.push(rec); save();
  if (state.sims.length > 40) state.sims = state.sims.slice(-40);
  exam = null;
  if (auto) toast('Tempo esgotado: prova entregue automaticamente.');
  location.hash = '#/simulado/resultado/' + rec.id;
}

/* ================= Resultado ================= */
let resultFilter = 'all';
function verdictHTML(s) {
  if (!s.espN) return '';
  const esp = Math.round((s.espOk / s.espN) * 20) * 2; // pontos projetados em 40
  const need = Math.max(0, 30 - esp);
  const minOk = esp >= 2;
  let cls, msg;
  if (!minOk) { cls = 'bad'; msg = `Projeção de ${esp} de 40 pontos em Conhecimentos Específicos: abaixo do mínimo de 2 pontos exigido pelo edital.`; }
  else if (need === 0) { cls = 'ok'; msg = `Projeção de ${esp} de 40 pontos em Conhecimentos Específicos: só com eles você já alcançaria os 30 pontos exigidos (desde que faça ao menos 1 ponto em cada disciplina geral).`; }
  else if (need <= 10) { cls = 'mid'; msg = `Projeção de ${esp} de 40 pontos em Conhecimentos Específicos: faltariam ${need} pontos nos conhecimentos gerais (de 20 possíveis) para chegar a 30.`; }
  else if (need <= 20) { cls = 'low'; msg = `Projeção de ${esp} de 40 pontos em Conhecimentos Específicos: seriam necessários ${need} dos 20 pontos dos conhecimentos gerais, margem apertada.`; }
  else { cls = 'bad'; msg = `Projeção de ${esp} de 40 pontos em Conhecimentos Específicos: mesmo acertando todos os conhecimentos gerais, não alcançaria os 30 pontos.`; }
  return `<div class="proj proj-${cls}">${msg}</div>`;
}

function viewResult(id) {
  const s = state.sims.find(x => x.id === id);
  if (!s) return `<div class="panel empty"><h3>Resultado não encontrado</h3><p>Ele pode ter sido apagado ao zerar os dados.</p><a class="btn btn-primary" href="#/simulado">Novo simulado</a></div>`;
  const keys = Object.keys(s.por);
  const proj = s.espN && s.espN < s.n ? Math.round((s.espOk / s.espN) * 20) * 2 : null;
  const items = s.qs.map((qid, i) => ({ q: QMAP[qid], i, ans: s.answers[i] })).filter(x => x.q && (resultFilter === 'all' || (resultFilter === 'wrong' && x.ans !== undefined && x.ans !== x.q.c) || (resultFilter === 'blank' && x.ans === undefined) || (resultFilter === 'right' && x.ans === x.q.c)));
  const wrongIds = s.qs.filter((qid, i) => s.answers[i] !== QMAP[qid].c);
  return `
  <div class="page-head">
    <div class="crumb"><a href="#/simulado">Simulador</a> · Resultado</div>
    <h1 class="page-title">${s.auto ? 'Tempo esgotado — prova entregue' : 'Prova entregue'}</h1>
    <p class="page-lead">${fmtDate(s.date)} · ${s.n} questões · ${s.mode === 'prova' ? 'gabarito ao final' : 'correção imediata'} · tempo usado ${fmtTime(s.used)} de ${fmtTime(s.total)} (${fmtTime(s.used / s.n)} por questão)</p>
  </div>
  <section class="panel">
    <div class="panel-body score-block">
      <div><div class="strip-label">Aproveitamento</div><div class="score-big ${lvl(s.score)}">${s.score}<small>%</small></div></div>
      <div>
        <table class="tbl"><tbody>
          <tr><td class="k">Acertos / erros / em branco</td><td class="num"><span style="color:var(--color-success)">${s.acertos}</span> / <span style="color:var(--color-error)">${s.erros}</span> / ${s.brancos}</td></tr>
          <tr><td class="k">Pontuação com os pesos do edital</td><td class="num">${fmtNum(s.pts)} de ${fmtNum(s.ptsMax)} pontos</td></tr>
          ${proj !== null ? `<tr><td class="k">Projeção em Conhecimentos Específicos</td><td class="num">${proj} de 40 pontos</td></tr>` : ''}
        </tbody></table>
        ${verdictHTML(s)}
        <p class="verdict muted">Referência do edital: aprovação com no mínimo 30 dos 60 pontos da prova objetiva, pelo menos 1 ponto em cada disciplina de conhecimentos gerais e 2 pontos em conhecimentos específicos. Conhecimentos específicos valem 2 pontos por questão; os gerais, 1 ponto.</p>
      </div>
    </div>
  </section>
  <section class="panel" style="margin-top:var(--space-5)">
    <div class="panel-head"><h2>Desempenho por assunto</h2></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Assunto</th><th class="bar-cell">Aproveitamento</th><th class="num">Acertos</th><th class="num">%</th></tr></thead><tbody>
      ${keys.sort((a, b) => pct(s.por[a].ok, s.por[a].n) - pct(s.por[b].ok, s.por[b].n)).map(k => { const st = { n: s.por[k].n, p: pct(s.por[k].ok, s.por[k].n) }; const [t, a] = k.split(':');
        return `<tr><td><a class="row-link" href="#/topico/${t}/resumo?s=${a}">${esc(ANAME[k])}</a><div class="xs muted">${TMAP[t].num} · ${esc(TMAP[t].title)}</div></td><td class="bar-cell mid">${barCell(st)}</td><td class="num">${s.por[k].ok}/${s.por[k].n}</td><td class="num">${pctCell(st)}</td></tr>`; }).join('')}
    </tbody></table></div>
  </section>
  <div class="btn-row" style="margin:var(--space-5) 0">
    ${wrongIds.length ? `<button class="btn btn-primary" data-action="redo-wrong" data-id="${s.id}">Refazer ${wrongIds.length} erradas e em branco</button>` : ''}
    <a class="btn" href="#/simulado">Novo simulado</a>
    <a class="btn" href="#/desempenho">Desempenho geral</a>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4)">
    <h2 class="h2" style="margin:0">Gabarito comentado</h2>
    <div class="seg" data-seg-result="1">${[['all', 'Todas'], ['wrong', 'Erradas'], ['blank', 'Em branco'], ['right', 'Certas']].map(([v, l]) => `<button type="button" data-v="${v}" class="${resultFilter === v ? 'on' : ''}">${l}</button>`).join('')}</div>
  </div>
  <div class="q-list">${items.length ? items.map(x => `<article class="q-card">${qMeta(x.q, x.i + 1)}<p class="q-text">${esc(x.q.q)}</p>${optionsHTML(x.q, x.ans, true, 'noop')}${commentHTML(x.q, x.ans)}</article>`).join('') : '<div class="panel empty"><h3>Nada a exibir neste filtro</h3></div>'}</div>`;
}

/* ================= Desempenho ================= */
function viewStats() {
  const all = statsFor(() => true);
  const sims = state.sims;
  const best = sims.length ? Math.max(...sims.map(s => s.score)) : null;
  const avgTime = sims.length ? sims.reduce((a, s) => a + s.used / s.n, 0) / sims.length : null;
  return `
  <div class="page-head">
    <div class="crumb">Prática</div>
    <h1 class="page-title">Desempenho</h1>
    <p class="page-lead">Consolida as respostas do banco de questões e dos simulados, por tópico e por assunto do edital.</p>
  </div>
  <div class="strip">
    <div><div class="strip-label">Aproveitamento geral</div><div class="strip-value">${all.n ? all.p + '%' : '—'}</div><div class="strip-sub">${all.ok} de ${all.n} tentativas</div></div>
    <div><div class="strip-label">Cobertura do banco</div><div class="strip-value">${pct(all.seen, all.total)}%</div><div class="strip-sub">${all.seen} de ${all.total} questões</div></div>
    <div><div class="strip-label">Melhor simulado</div><div class="strip-value">${best !== null ? best + '%' : '—'}</div><div class="strip-sub">${sims.length} realizado(s)</div></div>
    <div><div class="strip-label">Tempo médio</div><div class="strip-value">${avgTime !== null ? fmtTime(avgTime) : '—'}</div><div class="strip-sub">por questão (meta: 4:30)</div></div>
  </div>
  <div class="cols-2" style="margin-bottom:var(--space-5)">
    <section class="panel"><div class="panel-head"><h2>Evolução nos simulados</h2></div><div class="panel-body">
      ${sims.length ? `<div class="chart-wrap"><canvas id="evo-chart" aria-label="Gráfico de evolução das notas"></canvas></div>` : `<div class="empty"><h3>Sem simulados</h3><p>Faça um simulado para acompanhar a evolução.</p><a class="btn btn-sm btn-primary" href="#/simulado">Ir para o simulador</a></div>`}
    </div></section>
    <section class="panel"><div class="panel-head"><h2>Acerto por tópico</h2></div><div class="panel-body">
      ${all.n ? `<div class="chart-wrap"><canvas id="topic-chart" aria-label="Gráfico de acerto por tópico"></canvas></div>` : `<div class="empty"><h3>Sem respostas</h3><p>Resolva questões no banco ou em simulados.</p></div>`}
    </div></section>
  </div>
  <section class="panel" style="margin-bottom:var(--space-5)"><div class="panel-head"><h2>Por tópico e assunto</h2></div>${assuntoTable(TOPICS, true)}</section>
  <section class="panel" style="margin-bottom:var(--space-5)">
    <div class="panel-head"><h2>Cópia do progresso</h2></div>
    <div class="panel-body" style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);flex-wrap:wrap">
      <p class="muted small" style="margin:0;max-width:62ch">O progresso fica disponível enquanto esta página estiver aberta. Exporte um código para continuar depois ou em outro dispositivo.</p>
      <div class="btn-row"><button class="btn btn-primary" data-action="export">Exportar progresso</button><button class="btn" data-action="import">Importar</button></div>
    </div>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Histórico de simulados</h2><button class="btn btn-sm btn-ghost btn-danger" data-action="reset">Zerar todos os dados</button></div>
    ${sims.length ? sims.slice().reverse().map(histItem).join('') : '<div class="empty-inline">Nenhum simulado registrado.</div>'}
  </section>`;
}

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function drawChart() {
  if (!window.Chart) return;
  const text = cssVar('--color-text-muted'), grid = cssVar('--color-divider'), prim = cssVar('--color-primary');
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif"; Chart.defaults.font.size = 12; Chart.defaults.color = text;
  let c1 = null, c2 = null;
  const evo = $('#evo-chart');
  if (evo) {
    const sims = state.sims.slice(-15);
    c1 = new Chart(evo, {
      type: 'line',
      data: { labels: sims.map((s, i) => '#' + (state.sims.length - sims.length + i + 1)), datasets: [{ label: 'Aproveitamento (%)', data: sims.map(s => s.score), borderColor: prim, backgroundColor: prim, borderWidth: 2, tension: 0, pointRadius: 3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.y}% · ${sims[c.dataIndex].n} questões` } } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%', stepSize: 25 }, grid: { color: grid } }, x: { grid: { display: false } } } }
    });
  }
  const tc = $('#topic-chart');
  if (tc) {
    const data = TOPICS.map(t => topicStats(t.id));
    const colors = data.map(d => !d.n ? cssVar('--color-surface-3') : d.p >= 70 ? cssVar('--color-success') : d.p >= 50 ? cssVar('--color-warning') : cssVar('--color-error'));
    c2 = new Chart(tc, {
      type: 'bar',
      data: { labels: TOPICS.map(t => t.num + ' ' + t.abbr), datasets: [{ data: data.map(d => d.p), backgroundColor: colors, borderRadius: 1, maxBarThickness: 18 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x}% (${data[c.dataIndex].ok}/${data[c.dataIndex].n})` } } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%', stepSize: 25 }, grid: { color: grid } }, y: { grid: { display: false } } } }
    });
  }
  chartRef = { destroy() { if (c1) c1.destroy(); if (c2) c2.destroy(); } };
}

/* ================= Caderno de erros ================= */
function viewErrors() {
  const list = QS.filter(q => state.attempts[q.id] && state.attempts[q.id].last === false);
  const byTopic = TOPICS.map(t => ({ t, qs: list.filter(q => q.t === t.id) })).filter(x => x.qs.length);
  return `
  <div class="page-head">
    <div class="crumb">Prática</div>
    <h1 class="page-title">Caderno de erros</h1>
    <p class="page-lead">Questões erradas na última tentativa. Quando você acerta de novo, a questão sai do caderno.</p>
  </div>
  ${list.length ? `
  <div class="btn-row" style="margin-bottom:var(--space-5)"><button class="btn btn-primary" data-action="sim-errors">Treinar as ${list.length} questões erradas</button></div>
  ${byTopic.map(({ t, qs }) => `<h2 class="h2" style="margin-top:var(--space-6)">${t.num} · ${esc(t.title)} <span class="tag bad">${qs.length}</span></h2>
    <div class="q-list">${qs.map(q => qCard(q)).join('')}</div>`).join('')}`
  : `<div class="panel empty"><h3>Nenhuma questão no caderno</h3><p>As questões que você errar no banco ou nos simulados aparecem aqui.</p><a class="btn btn-primary" href="#/simulado">Ir para o simulador</a></div>`}`;
}

/* ================= Eventos ================= */
/* ================= Organização: tempo de estudo e cronograma ================= */
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DIAS_C = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const TIPOS = { resumo: 'Leitura de resumo', questoes: 'Questões', simulado: 'Simulado', revisao: 'Revisão', lei: 'Leitura de lei' };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dayIdx = d => (d.getDay() + 6) % 7;
function weekStart(ts) { const d = new Date(ts == null ? Date.now() : ts); d.setHours(0, 0, 0, 0); return d.getTime() - dayIdx(d) * 86400000; }
function dayStart(ts) { const d = new Date(ts == null ? Date.now() : ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function studiedSince(t0, t1 = Infinity) { return state.sessions.filter(s => s.start >= t0 && s.start < t1).reduce((a, s) => a + s.dur, 0) + (sw && sw.startedAt >= t0 ? swElapsed() : 0); }
function hm(sec) { const m = Math.round(sec / 60); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${String(r).padStart(2, '0')}` : `${r} min`; }
function topicLabel(t, a) { if (!t || !TMAP[t]) return 'Estudo geral'; return TMAP[t].num + ' · ' + TMAP[t].title + (a && ANAME[t + ':' + a] ? ' — ' + ANAME[t + ':' + a] : ''); }
function topicOptions(sel) { return `<option value="">Estudo geral (sem tópico)</option>` + TOPICS.map(t => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${t.num} · ${esc(t.title)}</option>`).join(''); }
function assuntoOptions(t, sel) { if (!t || !TMAP[t]) return '<option value="">—</option>'; return `<option value="">Todos os assuntos</option>` + TMAP[t].assuntos.map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join(''); }

/* ---------- Cronômetro de estudo ---------- */
let sw = null; // { t, a, mode, foco, pausa, phase, phaseAcc, acc, running, last, startedAt, cycles, agendaId }
let swCfg = { t: '', a: '', mode: 'livre', foco: 25, pausa: 5 };
let swInt = null;
function swElapsed() { return sw ? sw.acc : 0; }
function swTick() {
  if (!sw || !sw.running) return;
  const now = Date.now(); const dt = (now - sw.last) / 1000; sw.last = now;
  sw.phaseAcc += dt;
  if (sw.phase === 'foco') sw.acc += dt;
  if (sw.mode === 'pomodoro') {
    if (sw.phase === 'foco' && sw.phaseAcc >= sw.foco * 60) { sw.phase = 'pausa'; sw.phaseAcc = 0; sw.cycles++; beep(); toast(`Ciclo ${sw.cycles} concluído. Pausa de ${sw.pausa} minutos.`); swPaint(true); }
    else if (sw.phase === 'pausa' && sw.phaseAcc >= sw.pausa * 60) { sw.phase = 'foco'; sw.phaseAcc = 0; beep(); toast('Pausa encerrada. Novo ciclo de foco.'); swPaint(true); }
  }
  swPaint();
}
function swDisplay() {
  if (!sw) return { main: '00:00', sub: '' };
  if (sw.mode === 'pomodoro') {
    const left = (sw.phase === 'foco' ? sw.foco : sw.pausa) * 60 - sw.phaseAcc;
    return { main: fmtTime(left), sub: (sw.phase === 'foco' ? 'Foco' : 'Pausa') + ` · ciclo ${sw.cycles + (sw.phase === 'foco' ? 1 : 0)} · estudado ${fmtTime(sw.acc)}` };
  }
  return { main: fmtTime(sw.acc), sub: sw.running ? 'Em andamento' : 'Pausado' };
}
function swPaint(full) {
  const d = swDisplay();
  const a = document.getElementById('sw-time'); if (a) a.textContent = d.main;
  const b = document.getElementById('sw-sub'); if (b) b.textContent = d.sub;
  const c = document.getElementById('mh-sw-time'); if (c) c.textContent = sw ? fmtTime(sw.acc) : '';
  const n = document.getElementById('nav-sw-time'); if (n) n.textContent = sw ? fmtTime(sw.acc) : '';
  const box = document.getElementById('sw-box'); if (box && sw) box.dataset.phase = sw.phase;
  if (full && parseRoute()[0] === 'estudo') rerenderKeepScroll();
}
function swStart(opts = {}) {
  const o = Object.assign({}, swCfg, opts);
  sw = { t: o.t || '', a: o.a || '', mode: o.mode, foco: o.foco, pausa: o.pausa, phase: 'foco', phaseAcc: 0, acc: 0, running: true, last: Date.now(), startedAt: Date.now(), cycles: 0, agendaId: o.agendaId || null };
  clearInterval(swInt); swInt = setInterval(swTick, 1000);
  dirty = true;
}
function swToggle() { if (!sw) return; if (sw.running) { swTick(); sw.running = false; } else { sw.running = true; sw.last = Date.now(); } }
function swStop(saveIt) {
  if (!sw) return;
  swTick();
  clearInterval(swInt); swInt = null;
  const s = sw; sw = null;
  if (!saveIt) return;
  if (s.acc < 60) { toast('Sessões com menos de 1 minuto não são registradas.'); return; }
  const note = ($('#sw-note') && $('#sw-note').value.trim()) || '';
  state.sessions.push({ id: uid(), t: s.t, a: s.a, start: s.startedAt, dur: Math.round(s.acc), note });
  if (s.agendaId) { const it = state.agenda.find(x => x.id === s.agendaId); if (it) it.done = true; }
  save();
  toast('Sessão de ' + hm(s.acc) + ' registrada.');
}
function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = beep.ctx || (beep.ctx = new C());
    [0, 0.25].forEach(off => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.12, ctx.currentTime + off); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + off + 0.2); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + off); o.stop(ctx.currentTime + off + 0.22); });
  } catch (e) {}
}

function viewStudy() {
  const today = studiedSince(dayStart()), week = studiedSince(weekStart()), total = state.sessions.reduce((a, s) => a + s.dur, 0) + swElapsed();
  const meta = state.metaHoras * 3600;
  const cur = sw || Object.assign({ running: false }, swCfg);
  const d = swDisplay();
  const byTopic = {};
  state.sessions.forEach(s => { const k = s.t || ''; byTopic[k] = (byTopic[k] || 0) + s.dur; });
  const rows = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);
  const maxT = rows.length ? rows[0][1] : 1;
  // últimos 7 dias
  const days = []; for (let i = 6; i >= 0; i--) { const t0 = dayStart() - i * 86400000; days.push({ t0, sec: studiedSince(t0, t0 + 86400000) }); }
  const maxD = Math.max(3600, ...days.map(x => x.sec));
  const list = state.sessions.slice().sort((a, b) => b.start - a.start);
  const nowD = new Date();
  const dateVal = nowD.getFullYear() + '-' + String(nowD.getMonth() + 1).padStart(2, '0') + '-' + String(nowD.getDate()).padStart(2, '0');
  return `
  <div class="page-head">
    <div class="crumb">Organização</div>
    <h1 class="page-title">Tempo de estudo</h1>
    <p class="page-lead">Marque o tempo dedicado a cada tópico do edital. Use o modo livre ou ciclos de foco e pausa (método Pomodoro). O cronômetro continua contando enquanto você navega pelos resumos e questões.</p>
  </div>
  <div class="strip">
    <div><div class="strip-label">Hoje</div><div class="strip-value">${hm(today)}</div><div class="strip-sub">${fmtDay(nowD)}</div></div>
    <div><div class="strip-label">Nesta semana</div><div class="strip-value">${hm(week)}</div><div class="strip-sub">segunda a domingo</div></div>
    <div><div class="strip-label">Meta semanal</div><div class="strip-value">${pct(week, meta)}<small>%</small></div><div class="strip-sub">${hm(week)} de ${state.metaHoras} h</div></div>
    <div><div class="strip-label">Total registrado</div><div class="strip-value">${hm(total)}</div><div class="strip-sub">${state.sessions.length} ${state.sessions.length === 1 ? 'sessão' : 'sessões'}</div></div>
  </div>
  <div class="cols">
    <div class="stack">
      <section class="panel">
        <div class="panel-head"><h2>Cronômetro</h2>${sw ? `<span class="tag ${sw.running ? 'ok' : 'warn'}">${sw.running ? 'contando' : 'pausado'}</span>` : ''}</div>
        <div class="sw-box" id="sw-box" data-phase="${sw ? sw.phase : 'foco'}">
          <div class="sw-time" id="sw-time" aria-live="off">${sw ? d.main : (swCfg.mode === 'pomodoro' ? fmtTime(swCfg.foco * 60) : '00:00')}</div>
          <div class="sw-sub" id="sw-sub">${sw ? d.sub : (swCfg.mode === 'pomodoro' ? `${swCfg.foco} min de foco, ${swCfg.pausa} min de pausa` : 'Pronto para começar')}</div>
          <div class="btn-row" style="justify-content:center">
            ${!sw ? `<button class="btn btn-primary" data-action="sw-start"><i data-lucide="play"></i>Iniciar</button>`
              : `<button class="btn btn-primary" data-action="sw-toggle"><i data-lucide="${sw.running ? 'pause' : 'play'}"></i>${sw.running ? 'Pausar' : 'Retomar'}</button>
                 <button class="btn" data-action="sw-save"><i data-lucide="check"></i>Concluir e registrar</button>
                 <button class="btn btn-ghost" data-action="sw-discard">Descartar</button>`}
          </div>
        </div>
        <div class="form-grid">
          <label class="fg"><span class="field-label">Modo</span>
            <select class="select" id="sw-mode" ${sw ? 'disabled' : ''}><option value="livre" ${cur.mode === 'livre' ? 'selected' : ''}>Livre (cronômetro progressivo)</option><option value="pomodoro" ${cur.mode === 'pomodoro' ? 'selected' : ''}>Ciclos de foco e pausa</option></select></label>
          <label class="fg ${cur.mode === 'pomodoro' ? '' : 'is-hidden'}" id="sw-pomo"><span class="field-label">Foco / pausa (min)</span>
            <span style="display:flex;gap:var(--space-2)"><input class="input" type="number" id="sw-foco" min="5" max="120" value="${cur.foco}" ${sw ? 'disabled' : ''} style="width:50%"><input class="input" type="number" id="sw-pausa" min="1" max="60" value="${cur.pausa}" ${sw ? 'disabled' : ''} style="width:50%"></span></label>
          <label class="fg"><span class="field-label">Tópico</span><select class="select" id="sw-t">${topicOptions(cur.t)}</select></label>
          <label class="fg"><span class="field-label">Assunto</span><select class="select" id="sw-a" ${cur.t ? '' : 'disabled'}>${assuntoOptions(cur.t, cur.a)}</select></label>
          <label class="fg fg-wide"><span class="field-label">Anotação (opcional)</span><input class="input" id="sw-note" maxlength="140" placeholder="Ex.: li o resumo e fiz 10 questões"></label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Sessões registradas</h2><span class="xs">${list.length ? 'mais recentes primeiro' : ''}</span></div>
        ${list.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Data</th><th>Tópico</th><th class="num">Duração</th><th></th></tr></thead>
          <tbody>${list.slice(0, 60).map(s => `<tr><td class="tnum" style="white-space:nowrap">${fmtDate(s.start)}</td><td>${esc(topicLabel(s.t, s.a))}${s.note ? `<div class="xs muted">${esc(s.note)}</div>` : ''}</td><td class="num">${hm(s.dur)}</td><td class="num"><button class="btn btn-sm btn-ghost" data-action="sess-del" data-id="${s.id}" aria-label="Excluir sessão">Excluir</button></td></tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty-inline">Nenhuma sessão registrada. Inicie o cronômetro ou registre um período manualmente.</div>'}
      </section>
    </div>

    <div class="stack">
      <section class="panel">
        <div class="panel-head"><h2>Últimos 7 dias</h2></div>
        <div class="panel-body"><div class="days-bars">${days.map(x => { const dd = new Date(x.t0); return `<div class="db"><div class="db-col"><span style="height:${Math.round((x.sec / maxD) * 100)}%"></span></div><div class="db-v">${x.sec ? hm(x.sec) : '—'}</div><div class="db-l">${DIAS_C[dayIdx(dd)]}</div></div>`; }).join('')}</div></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Tempo por tópico</h2></div>
        ${rows.length ? `<table class="tbl"><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k && TMAP[k] ? TMAP[k].num + ' · ' + TMAP[k].title : 'Estudo geral')}<div class="bar" style="margin-top:4px"><span style="width:${Math.round((v / maxT) * 100)}%"></span></div></td><td class="num" style="white-space:nowrap">${hm(v)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-inline">A distribuição do tempo aparece aqui depois da primeira sessão.</div>'}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Meta semanal</h2></div>
        <div class="panel-body">
          <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap"><input class="input" type="number" id="meta-h" min="1" max="80" value="${state.metaHoras}" style="width:90px"><span class="small">horas por semana</span><button class="btn btn-sm" data-action="meta-save">Salvar</button></div>
          <div class="bar ${week >= meta ? 'ok' : ''}" style="margin-top:var(--space-3)"><span style="width:${Math.min(100, pct(week, meta))}%"></span></div>
          <p class="xs muted" style="margin:var(--space-2) 0 0">Planejado no cronograma: ${hm(agendaPlanned())} por semana.</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Registrar manualmente</h2></div>
        <div class="form-grid one">
          <label class="fg"><span class="field-label">Data e início</span><span style="display:flex;gap:var(--space-2)"><input class="input" type="date" id="man-d" value="${dateVal}" style="flex:1"><input class="input" type="time" id="man-h" value="08:00" style="width:110px"></span></label>
          <label class="fg"><span class="field-label">Duração (minutos)</span><input class="input" type="number" id="man-min" min="1" max="720" value="60"></label>
          <label class="fg"><span class="field-label">Tópico</span><select class="select" id="man-t">${topicOptions('')}</select></label>
          <label class="fg"><span class="field-label">Assunto</span><select class="select" id="man-a" disabled>${assuntoOptions('', '')}</select></label>
          <div class="fg"><button class="btn btn-primary" data-action="man-add">Adicionar sessão</button></div>
        </div>
      </section>
    </div>
  </div>
  ${footerNote()}`;
}

/* ---------- Cronograma ---------- */
let agEdit = null; // id em edição
function agendaPlanned() { return state.agenda.reduce((a, x) => a + x.dur * 60, 0); }
function endTime(h, dur) { const [H, M] = h.split(':').map(Number); const t = H * 60 + M + dur; return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
function agItem(x) {
  return `<div class="ag-item ${x.done ? 'done' : ''}">
    <label class="ag-check"><input type="checkbox" data-ag-done="${x.id}" ${x.done ? 'checked' : ''} aria-label="Marcar como concluído"></label>
    <div class="ag-main">
      <div class="ag-time tnum">${x.hora}–${endTime(x.hora, x.dur)}</div>
      <div class="ag-title">${esc(x.t && TMAP[x.t] ? TMAP[x.t].num + ' · ' + TMAP[x.t].title : 'Estudo geral')}</div>
      <div class="xs muted">${esc(TIPOS[x.tipo] || x.tipo)}${x.a && ANAME[x.t + ':' + x.a] ? ' · ' + esc(ANAME[x.t + ':' + x.a]) : ''}${x.obs ? ' · ' + esc(x.obs) : ''}</div>
      <div class="ag-actions">
        <button class="lnk" data-action="ag-go" data-id="${x.id}" title="Iniciar o cronômetro com este tópico">Estudar agora</button>
        <button class="lnk" data-action="ag-edit" data-id="${x.id}">Editar</button>
        <button class="lnk danger" data-action="ag-del" data-id="${x.id}">Remover</button>
      </div>
    </div>
  </div>`;
}
function viewAgenda() {
  const ed = agEdit ? state.agenda.find(x => x.id === agEdit) : null;
  const f = ed || { dia: dayIdx(new Date()), hora: '19:00', dur: 60, t: '', a: '', tipo: 'resumo', obs: '' };
  const planned = agendaPlanned();
  const doneSec = state.agenda.filter(x => x.done).reduce((a, x) => a + x.dur * 60, 0);
  const week = studiedSince(weekStart());
  const todayI = dayIdx(new Date());
  const byDay = DIAS.map((_, i) => state.agenda.filter(x => x.dia === i).sort((a, b) => a.hora.localeCompare(b.hora)));
  return `
  <div class="page-head">
    <div class="crumb">Organização</div>
    <h1 class="page-title">Meu cronograma</h1>
    <p class="page-lead">Monte sua semana de estudos: escolha o dia, o horário, a duração e o que estudar. Marque cada atividade ao concluir e, no início da semana seguinte, use "Nova semana" para recomeçar.</p>
  </div>
  <div class="strip">
    <div><div class="strip-label">Planejado por semana</div><div class="strip-value">${hm(planned)}</div><div class="strip-sub">${state.agenda.length} ${state.agenda.length === 1 ? 'atividade' : 'atividades'}</div></div>
    <div><div class="strip-label">Concluído</div><div class="strip-value">${pct(doneSec, planned)}<small>%</small></div><div class="strip-sub">${state.agenda.filter(x => x.done).length} de ${state.agenda.length}</div></div>
    <div><div class="strip-label">Estudado nesta semana</div><div class="strip-value">${hm(week)}</div><div class="strip-sub">pelo cronômetro</div></div>
    <div><div class="strip-label">Meta semanal</div><div class="strip-value">${state.metaHoras}<small> h</small></div><div class="strip-sub"><a href="#/estudo">ajustar meta</a></div></div>
  </div>

  <section class="panel" id="ag-form-panel">
    <div class="panel-head"><h2>${ed ? 'Editar atividade' : 'Adicionar atividade'}</h2>${ed ? '<button class="btn btn-sm btn-ghost" data-action="ag-cancel">Cancelar edição</button>' : ''}</div>
    <div class="form-grid ag-form">
      <div class="fg fg-wide"><span class="field-label">${ed ? 'Dia' : 'Dias da semana'}</span>
        <div class="day-picks">${DIAS_C.map((d, i) => `<label class="day-pick"><input type="${ed ? 'radio' : 'checkbox'}" name="ag-dia" value="${i}" ${f.dia === i ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        ${ed ? '' : '<span class="field-help">Marque mais de um dia para repetir a mesma atividade.</span>'}
      </div>
      <label class="fg"><span class="field-label">Início</span><input class="input" type="time" id="ag-hora" value="${f.hora}"></label>
      <label class="fg"><span class="field-label">Duração</span><select class="select" id="ag-dur">${[30, 45, 60, 90, 120, 150, 180].map(m => `<option value="${m}" ${f.dur === m ? 'selected' : ''}>${m < 60 ? m + ' min' : (m / 60).toString().replace('.', ',') + ' h'}</option>`).join('')}</select></label>
      <label class="fg"><span class="field-label">Atividade</span><select class="select" id="ag-tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="fg"><span class="field-label">Tópico</span><select class="select" id="ag-t">${topicOptions(f.t)}</select></label>
      <label class="fg"><span class="field-label">Assunto</span><select class="select" id="ag-a" ${f.t ? '' : 'disabled'}>${assuntoOptions(f.t, f.a)}</select></label>
      <label class="fg"><span class="field-label">Observação</span><input class="input" id="ag-obs" maxlength="80" value="${esc(f.obs || '')}" placeholder="Opcional"></label>
      <div class="fg fg-wide"><div class="btn-row"><button class="btn btn-primary" data-action="ag-save">${ed ? 'Salvar alteração' : 'Adicionar ao cronograma'}</button><span class="xs muted" id="ag-err" style="color:var(--color-error)"></span></div></div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>Semana</h2>
      <div class="btn-row">
        <button class="btn btn-sm" data-action="ag-suggest">Sugerir cronograma</button>
        <button class="btn btn-sm" data-action="ag-newweek" ${state.agenda.some(x => x.done) ? '' : 'disabled'}>Nova semana</button>
        <button class="btn btn-sm btn-ghost" data-action="ag-clear" ${state.agenda.length ? '' : 'disabled'}>Limpar</button>
      </div>
    </div>
    ${state.agenda.length ? `<div class="week">${byDay.map((items, i) => `<div class="wk-day ${i === todayI ? 'today' : ''}">
        <div class="wk-head"><b>${DIAS[i]}</b>${i === todayI ? ' <span class="tag primary">hoje</span>' : ''}<span class="xs muted">${items.length ? hm(items.reduce((a, x) => a + x.dur * 60, 0)) : ''}</span></div>
        ${items.length ? items.map(agItem).join('') : '<div class="wk-empty">Livre</div>'}
      </div>`).join('')}</div>`
      : `<div class="empty-inline">O cronograma está vazio. Adicione atividades acima ou clique em "Sugerir cronograma" para partir de um modelo baseado nos pesos do edital e ajustá-lo à sua rotina.</div>`}
  </section>
  ${footerNote()}`;
}
function suggestAgenda() {
  const plan = ['ssedu', 'poledu', 'seg', 'direitos', 'tecop', 'etica', 'fund', 'gerais'];
  const items = [];
  const add = (dia, hora, dur, t, tipo, obs) => items.push({ id: uid(), dia, hora, dur, t, a: '', tipo, obs: obs || '', done: false });
  // Seg a sex: 1 h de resumo + 45 min de questões; sábado: simulado; domingo: revisão
  for (let d = 0; d < 5; d++) { const t1 = plan[(d * 2) % plan.length], t2 = plan[(d * 2 + 1) % plan.length]; add(d, '19:00', 60, t1, 'resumo'); add(d, '20:15', 45, t2, 'questoes'); }
  add(5, '09:00', 90, '', 'simulado', '20 questões, formato da prova');
  add(5, '10:45', 45, '', 'revisao', 'Corrigir e anotar erros');
  add(6, '15:00', 60, '', 'revisao', 'Caderno de erros');
  return items;
}

/* ---------- Ações ---------- */
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-action]'); if (!el) return;
  const act = el.dataset.action; const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  switch (act) {
    case 'sw-start': {
      swCfg = { t: val('sw-t'), a: val('sw-a'), mode: val('sw-mode') || 'livre', foco: Math.max(5, Math.min(120, +val('sw-foco') || 25)), pausa: Math.max(1, Math.min(60, +val('sw-pausa') || 5)) };
      swStart(); rerenderKeepScroll(); break;
    }
    case 'sw-toggle': swToggle(); rerenderKeepScroll(); break;
    case 'sw-save': swStop(true); rerenderKeepScroll(); break;
    case 'sw-discard': { const ok = await modal({ title: 'Descartar esta sessão?', body: 'O tempo contado não será registrado.', confirm: 'Descartar', danger: true }); if (ok) { swStop(false); rerenderKeepScroll(); } break; }
    case 'sess-del': { state.sessions = state.sessions.filter(s => s.id !== el.dataset.id); save(); rerenderKeepScroll(); toast('Sessão excluída.'); break; }
    case 'meta-save': { const v = Math.round(+val('meta-h')); if (v >= 1 && v <= 80) { state.metaHoras = v; save(); rerenderKeepScroll(); toast('Meta semanal atualizada.'); } else toast('Informe um valor entre 1 e 80 horas.'); break; }
    case 'man-add': {
      const dstr = val('man-d'), h = val('man-h') || '08:00', m = Math.round(+val('man-min'));
      if (!dstr || !(m >= 1 && m <= 720)) { toast('Informe a data e uma duração entre 1 e 720 minutos.'); break; }
      const [Y, M, D] = dstr.split('-').map(Number); const [hh, mm] = h.split(':').map(Number);
      const ts = new Date(Y, M - 1, D, hh, mm).getTime();
      state.sessions.push({ id: uid(), t: val('man-t'), a: val('man-a'), start: ts, dur: m * 60, note: 'registro manual' });
      save(); rerenderKeepScroll(); toast('Sessão de ' + hm(m * 60) + ' adicionada.'); break;
    }
    case 'ag-save': {
      const dias = [...document.querySelectorAll('input[name="ag-dia"]:checked')].map(i => +i.value);
      const hora = val('ag-hora');
      if (!dias.length) { $('#ag-err').textContent = 'Escolha pelo menos um dia.'; break; }
      if (!/^\d{2}:\d{2}$/.test(hora)) { $('#ag-err').textContent = 'Informe o horário de início.'; break; }
      const base = { hora, dur: +val('ag-dur'), tipo: val('ag-tipo'), t: val('ag-t'), a: val('ag-a'), obs: val('ag-obs').trim() };
      if (agEdit) { const it = state.agenda.find(x => x.id === agEdit); Object.assign(it, base, { dia: dias[0] }); agEdit = null; toast('Atividade atualizada.'); }
      else { dias.forEach(d => state.agenda.push(Object.assign({ id: uid(), dia: d, done: false }, base))); toast(dias.length > 1 ? `${dias.length} atividades adicionadas.` : 'Atividade adicionada.'); }
      save(); rerenderKeepScroll(); break;
    }
    case 'ag-edit': agEdit = el.dataset.id; rerenderKeepScroll(); { const p = $('#ag-form-panel'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
    case 'ag-cancel': agEdit = null; rerenderKeepScroll(); break;
    case 'ag-del': { state.agenda = state.agenda.filter(x => x.id !== el.dataset.id); if (agEdit === el.dataset.id) agEdit = null; save(); rerenderKeepScroll(); toast('Atividade removida.'); break; }
    case 'ag-go': {
      const it = state.agenda.find(x => x.id === el.dataset.id); if (!it) break;
      if (sw) { const ok = await modal({ title: 'Há um cronômetro em andamento', body: 'Registrar a sessão atual e iniciar uma nova para esta atividade?', confirm: 'Registrar e iniciar' }); if (!ok) break; swStop(true); }
      swCfg = Object.assign({}, swCfg, { t: it.t, a: it.a, mode: 'livre' }); swStart({ agendaId: it.id });
      location.hash = '#/estudo'; toast('Cronômetro iniciado. Ao registrar, a atividade será marcada como concluída.'); break;
    }
    case 'ag-suggest': {
      if (state.agenda.length) { const ok = await modal({ title: 'Substituir o cronograma atual?', body: 'As atividades atuais serão trocadas pelo modelo sugerido, que você pode editar depois.', confirm: 'Substituir' }); if (!ok) break; }
      state.agenda = suggestAgenda(); agEdit = null; save(); rerenderKeepScroll(); toast('Modelo aplicado. Ajuste dias e horários à sua rotina.'); break;
    }
    case 'ag-newweek': state.agenda.forEach(x => x.done = false); save(); rerenderKeepScroll(); toast('Marcações zeradas para a nova semana.'); break;
    case 'ag-clear': { const ok = await modal({ title: 'Limpar o cronograma?', body: 'Todas as atividades serão removidas.', confirm: 'Limpar', danger: true }); if (ok) { state.agenda = []; agEdit = null; save(); rerenderKeepScroll(); } break; }
  }
});
document.addEventListener('change', ev => {
  const id = ev.target.id;
  if (ev.target.dataset.agDone) { const it = state.agenda.find(x => x.id === ev.target.dataset.agDone); if (it) { it.done = ev.target.checked; save(); rerenderKeepScroll(); } return; }
  if (id === 'sw-t' || id === 'ag-t' || id === 'man-t') {
    const a = document.getElementById(id.replace('-t', '-a')); a.innerHTML = assuntoOptions(ev.target.value, ''); a.disabled = !ev.target.value;
    if (id === 'sw-t') { swCfg.t = ev.target.value; swCfg.a = ''; if (sw) { sw.t = swCfg.t; sw.a = ''; } }
  }
  if (id === 'sw-a') { swCfg.a = ev.target.value; if (sw) sw.a = swCfg.a; }
  if (id === 'sw-mode') { swCfg.mode = ev.target.value; const p = $('#sw-pomo'); if (p) p.classList.toggle('is-hidden', swCfg.mode !== 'pomodoro'); const t = $('#sw-time'); if (t) t.textContent = swCfg.mode === 'pomodoro' ? fmtTime(swCfg.foco * 60) : '00:00'; const s = $('#sw-sub'); if (s) s.textContent = swCfg.mode === 'pomodoro' ? `${swCfg.foco} min de foco, ${swCfg.pausa} min de pausa` : 'Pronto para começar'; }
  if (id === 'sw-foco' || id === 'sw-pausa') { swCfg[id.slice(3)] = +ev.target.value; }
});

/* ---------- Painel: resumo do dia ---------- */
function homeOrgPanel() {
  const todayI = dayIdx(new Date());
  const items = state.agenda.filter(x => x.dia === todayI).sort((a, b) => a.hora.localeCompare(b.hora));
  const week = studiedSince(weekStart());
  return `<section class="panel">
    <div class="panel-head"><h2>Hoje · ${DIAS[todayI]}</h2><a class="xs" href="#/cronograma">Meu cronograma</a></div>
    <div class="panel-body" style="padding-bottom:var(--space-3)">
      <div style="display:flex;justify-content:space-between;gap:var(--space-3);align-items:baseline;flex-wrap:wrap">
        <span class="small">Estudado hoje: <b class="tnum">${hm(studiedSince(dayStart()))}</b> · semana: <b class="tnum">${hm(week)}</b> de ${state.metaHoras} h</span>
        ${sw ? `<a class="btn btn-sm" href="#/estudo">Cronômetro em andamento</a>` : `<a class="btn btn-sm" href="#/estudo">Iniciar cronômetro</a>`}
      </div>
      <div class="bar ${week >= state.metaHoras * 3600 ? 'ok' : ''}" style="margin-top:var(--space-2)"><span style="width:${Math.min(100, pct(week, state.metaHoras * 3600))}%"></span></div>
    </div>
    ${items.length ? `<div class="ag-today">${items.map(agItem).join('')}</div>` : `<div class="empty-inline">${state.agenda.length ? 'Nenhuma atividade planejada para hoje.' : 'Monte seu cronograma semanal para ver aqui as atividades do dia.'}</div>`}
  </section>`;
}

document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-action]');
  if (!el) {
    const segBtn = ev.target.closest('[data-seg] button, [data-seg-result] button');
    if (segBtn) handleSeg(segBtn);
    return;
  }
  const act = el.dataset.action;
  switch (act) {
    case 'goto': { const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    case 'toggle-read': { const k = el.dataset.key; if (state.read[k]) delete state.read[k]; else state.read[k] = Date.now(); save(); rerenderKeepScroll(); toast(state.read[k] ? 'Resumo marcado como lido.' : 'Marcação removida.'); break; }
    case 'cut': {
      const qid = el.dataset.q, i = +el.dataset.i;
      const nowCut = toggleCut(qid, i);
      if (el.dataset.ctx === 'exam-answer') { if (nowCut && exam && exam.answers[exam.idx] === i) delete exam.answers[exam.idx]; router(); }
      else if (parseRoute()[0] === 'questoes' && qzOpt.modo === 'uma') qzRefresh(); else replaceCard(QMAP[qid]);
      break;
    }
    case 'bank-answer': {
      const q = QMAP[el.dataset.q]; const i = +el.dataset.i;
      if (bankAnswers[q.id] !== undefined) break;
      if (isCut(q.id, i)) { toggleCut(q.id, i); if (parseRoute()[0] === 'questoes' && qzOpt.modo === 'uma') qzRefresh(); else replaceCard(q); break; }
      bankAnswers[q.id] = i; recordAttempt(q.id, i === q.c); save();
      if (parseRoute()[0] === 'questoes' && qzOpt.modo === 'uma') qzRefresh(); else if (parseRoute()[0] === 'topico') rerenderKeepScroll(); else { replaceCard(q); qzSumRefresh(); }
      renderNav(parseRoute()); break;
    }
    case 'bank-reveal': { const q = QMAP[el.dataset.q]; bankReveal[q.id] = true; persistLocalProgress(); if (parseRoute()[0] === 'questoes' && qzOpt.modo === 'uma') qzRefresh(); else if (parseRoute()[0] === 'topico') rerenderKeepScroll(); else { replaceCard(q); qzSumRefresh(); } renderNav(parseRoute()); break; }
    case 'bank-reveal-all': { let k = 0; QS.forEach(q => { if (q.t === el.dataset.t && isPending(q.id)) { bankReveal[q.id] = true; k++; } }); persistLocalProgress(); rerenderKeepScroll(); toast(k + (k === 1 ? ' questão corrigida.' : ' questões corrigidas.')); break; }
    case 'qz-reveal-all': { const list = qzList(); let k = 0; list.forEach(q => { if (bankAnswers[q.id] !== undefined && !bankReveal[q.id]) { bankReveal[q.id] = true; k++; } }); persistLocalProgress(); qzRefresh(); renderNav(parseRoute()); toast(k + (k === 1 ? ' questão corrigida.' : ' questões corrigidas.')); break; }
    case 'qz-more': { qzShown += QZ_STEP; const y = window.scrollY; qzRefresh(); window.scrollTo(0, y); break;
    }
    case 'bank-retry': { delete bankAnswers[el.dataset.q]; delete bankReveal[el.dataset.q]; delete cuts[el.dataset.q]; persistLocalProgress(); if (parseRoute()[0] === 'questoes' && qzOpt.modo === 'uma') qzRefresh(); else { replaceCard(QMAP[el.dataset.q]); qzSumRefresh(); } break; }
    case 'qz-modo': qzOpt.modo = el.dataset.v; qzResetPos(); rerenderKeepScroll(); break;
    case 'qz-ordem': qzOpt.ordem = el.dataset.v; if (el.dataset.v === 'aleatoria') qzShuffle(); qzResetPos(); rerenderKeepScroll(); if (el.dataset.v === 'aleatoria') toast('Questões embaralhadas.'); break;
    case 'qz-toggle': qzOpen = !qzOpen; rerenderKeepScroll(); break;
    case 'qz-clear': qz = QZ_BLANK(); qzResetPos(); rerenderKeepScroll(); break;
    case 'qz-prev': if (qzIdx > 0) { qzIdx--; qzRefresh(true); } break;
    case 'qz-next': qzIdx++; qzRefresh(true); break;
    case 'qz-go': qzIdx = +el.dataset.i; qzRefresh(true); break;
    case 'qz-page': qzPage = +el.dataset.v; qzRefresh(true); break;
    case 'clear-filters': bankFilter = { a: 'all', status: 'all', dif: 'all' }; rerenderKeepScroll(); break;
    case 'preset': applyPreset(el.dataset.p); rerenderKeepScroll(); break;
    case 'preset-sim': { applyPreset(el.dataset.p); const pool = poolFromCfg(); startExam(pickQuestions(pool, cfg.n, 'mix').map(q => q.id), cfg); break; }
    case 'topic-sim': { const pool = QS.filter(q => q.t === el.dataset.t); startExam(shuffle(pool).map(q => q.id), { tempoAuto: true, mode: 'prova' }); break; }
    case 'cfg-all': { const v = el.dataset.v === '1'; Object.keys(cfg.sel).forEach(k => cfg.sel[k] = v); rerenderKeepScroll(); break; }
    case 'start-sim': {
      if (exam && !exam.finished) { const ok = await modal({ title: 'Substituir simulado em andamento?', body: 'O simulado atual será descartado sem registrar resultado.', confirm: 'Substituir' }); if (!ok) break; }
      const pool = poolFromCfg(); if (!pool.length) break;
      startExam(pickQuestions(pool, Math.min(cfg.n, pool.length), cfg.prior).map(q => q.id), cfg); break;
    }
    case 'exam-answer': { const i = +el.dataset.i; if (isCut(el.dataset.q, i)) toggleCut(el.dataset.q, i); else exam.answers[exam.idx] = i; persistLocalProgress(); router(); break; }
    case 'clear-answer': { delete exam.answers[exam.idx]; persistLocalProgress(); router(); break; }
    case 'check': { exam.checked[exam.idx] = true; persistLocalProgress(); router(); break; }
    case 'flag': { exam.flags[exam.idx] = !exam.flags[exam.idx]; persistLocalProgress(); router(); break; }
    case 'prev': exam.idx = Math.max(0, exam.idx - 1); persistLocalProgress(); router(); break;
    case 'next': exam.idx = Math.min(exam.qs.length - 1, exam.idx + 1); persistLocalProgress(); router(); break;
    case 'jump': exam.idx = +el.dataset.i; persistLocalProgress(); router(); break;
    case 'pause': exam.paused = !exam.paused; persistLocalProgress(); router(); break;
    case 'finish': finishExam(false); break;
    case 'abort': { const ok = await modal({ title: 'Desistir do simulado?', body: 'As respostas não serão registradas nas estatísticas.', confirm: 'Desistir', danger: true }); if (ok) { exam = null; clearInterval(timerId); persistLocalProgress(); location.hash = '#/simulado'; } break; }
    case 'redo-wrong': { const s = state.sims.find(x => x.id === el.dataset.id); const ids = s.qs.filter((qid, i) => s.answers[i] !== QMAP[qid].c); startExam(shuffle(ids), { tempoAuto: true, mode: 'treino' }); break; }
    case 'sim-errors': { const ids = QS.filter(q => state.attempts[q.id] && state.attempts[q.id].last === false).map(q => q.id); startExam(shuffle(ids), { tempoAuto: true, mode: 'treino' }); break; }
    case 'export': openExport(); break;
    case 'import': openImport(); break;
    case 'reset': { const ok = await modal({ title: 'Zerar todos os dados?', body: 'Serão apagadas todas as respostas, simulados, marcações de leitura, sessões de estudo e o cronograma. Esta ação não pode ser desfeita.', confirm: 'Zerar dados', danger: true }); if (ok) { state = blankState(); bankAnswers = {}; bankReveal = {}; exam = null; clearLocalProgress(); clearInterval(timerId); clearInterval(swInt); sw = null; agEdit = null; dirty = false; router(); toast('Dados zerados.'); } break; }
  }
});

function dialogShell(title, inner, options = {}) {
  const root = $('#modal-root');
  const gate = options.gate === true;
  root.classList.toggle('auth-gate', gate);
  root.innerHTML = `<div class="scrim show" style="z-index:90" ${gate ? '' : 'data-close="1"'}></div>
    <div role="dialog" aria-modal="true" aria-labelledby="auth-title" class="dialog${gate ? ' auth-gate-card' : ''}"${gate ? '' : ' style="width:min(560px,calc(100vw - 32px))"'}>
      ${gate ? `<aside class="auth-gate-hero"><span class="auth-gate-mark" aria-hidden="true">A</span><div><span class="auth-gate-kicker">APROVAÍ · PMCG 2026</span><h2>Seu próximo passo começa aqui.</h2><p>Resumos, questões comentadas e simulados para organizar sua preparação.</p></div><span class="auth-gate-foot">ASSISTENTE SOCIAL EDUCACIONAL</span></aside><section class="auth-gate-main"><span class="auth-gate-mobile-mark">APROVAÍ</span><h3 id="auth-title">${title}</h3>${inner}</section>` : `<h3 id="auth-title">${title}</h3>${inner}`}
    </div>`;
  root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => { root.innerHTML = ''; }));
  return root;
}
function openExport() {
  const code = exportCode();
  const root = dialogShell('Exportar progresso', `
    <p class="muted small">Copie o código e guarde-o em local seguro. Para restaurar, use Importar e cole o código.</p>
    <textarea class="input" id="exp-code" readonly style="width:100%;height:140px;font-family:var(--font-mono);font-size:12px;resize:vertical">${esc(code)}</textarea>
    <div class="btn-row" style="justify-content:flex-end;margin-top:var(--space-4)">
      <button class="btn" data-close="1">Fechar</button>
      <a class="btn" id="exp-dl" download="caderno-ss-progresso.json" href="data:application/json;charset=utf-8,${encodeURIComponent(code)}">Baixar arquivo</a>
      <button class="btn btn-primary" id="exp-copy">Copiar código</button>
    </div>`);
  root.querySelector('#exp-copy').addEventListener('click', async () => {
    const ta = root.querySelector('#exp-code'); ta.select();
    let ok = false;
    try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) {} }
    toast(ok ? 'Código copiado.' : 'Selecione o texto e copie manualmente.');
    if (ok) dirty = false;
  });
  root.querySelector('#exp-dl').addEventListener('click', () => { dirty = false; });
}
function openImport() {
  const root = dialogShell('Importar progresso', `
    <p class="muted small">Cole o código ou escolha o arquivo exportado. O progresso atual será substituído.</p>
    <textarea class="input" id="imp-code" style="width:100%;height:140px;font-family:var(--font-mono);font-size:12px;resize:vertical" placeholder='{"app":"caderno-ss", ...}'></textarea>
    <label class="btn btn-sm" style="margin-top:var(--space-3)">Escolher arquivo<input type="file" id="imp-file" accept=".json,application/json" class="sr-only"></label>
    <p class="xs" id="imp-err" style="color:var(--color-error);min-height:1.2em;margin:var(--space-2) 0 0"></p>
    <div class="btn-row" style="justify-content:flex-end">
      <button class="btn" data-close="1">Cancelar</button>
      <button class="btn btn-primary" id="imp-go">Importar</button>
    </div>`);
  root.querySelector('#imp-file').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => { root.querySelector('#imp-code').value = rd.result; }; rd.readAsText(f);
  });
  root.querySelector('#imp-go').addEventListener('click', () => {
    try { importCode(root.querySelector('#imp-code').value.trim()); root.innerHTML = ''; bankAnswers = {}; bankReveal = {}; exam = null; clearInterval(timerId); persistLocalProgress(); router(); toast('Progresso importado.'); }
    catch (e) { root.querySelector('#imp-err').textContent = 'Código inválido. Verifique se copiou o texto completo.'; }
  });
}

function handleSeg(btn) {
  const wrap = btn.parentElement;
  if (wrap.dataset.segResult) { resultFilter = btn.dataset.v; rerenderKeepScroll(); return; }
  const key = wrap.dataset.seg; const v = btn.dataset.v;
  if (key === 'tempoAuto') cfg.tempoAuto = v === '1'; else cfg[key] = v;
  wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
  if (key === 'tempoAuto') $('#cfg-min-row').style.display = cfg.tempoAuto ? 'none' : '';
  updateConfigSummary();
}

function replaceCard(q) {
  const old = document.getElementById('q-' + q.id); if (!old) return;
  const numEl = old.querySelector('.q-num');
  const num = numEl ? parseInt(numEl.textContent.replace(/\D/g, ''), 10) : undefined;
  const tmp = document.createElement('div'); tmp.innerHTML = qCard(q, num);
  old.replaceWith(tmp.firstElementChild); icons();
}

function rerenderKeepScroll() { const y = window.scrollY; router.first = true; router(); window.scrollTo(0, y); }

document.addEventListener('change', ev => {
  const f = ev.target.dataset.filter;
  if (f) { bankFilter[f] = ev.target.value; rerenderKeepScroll(); return; }
  const z = ev.target.dataset.qz;
  if (z) { qz[z] = ev.target.value; if (z === 't') qz.a = 'all'; qzResetPos(); rerenderKeepScroll(); return; }
  if (ev.target.dataset.cfgKey) { cfg.sel[ev.target.dataset.cfgKey] = ev.target.checked; rerenderKeepScroll(); return; }
  if (ev.target.dataset.cfgTopic) { const t = TMAP[ev.target.dataset.cfgTopic]; t.assuntos.forEach(a => cfg.sel[t.id + ':' + a.id] = ev.target.checked); rerenderKeepScroll(); return; }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'qz-busca') { qz.busca = ev.target.value; qzResetPos(); clearTimeout(qzRefresh._t); qzRefresh._t = setTimeout(() => qzRefresh(), 180); return; }
  if (ev.target.id === 'cfg-n') { cfg.n = +ev.target.value; $('#cfg-n-val').textContent = cfg.n; updateConfigSummary(); }
  if (ev.target.id === 'cfg-min') { cfg.minutos = +ev.target.value; $('#cfg-min-val').textContent = cfg.minutos; updateConfigSummary(); }
});
document.addEventListener('keydown', ev => {
  if (parseRoute()[0] === 'questoes' && qzOpt.modo === 'uma') {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) || $('#modal-root').children.length || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const list = qzList(); if (!list.length) return;
    if (ev.key === 'ArrowRight' && qzIdx < list.length - 1) { qzIdx++; qzRefresh(true); }
    else if (ev.key === 'ArrowLeft' && qzIdx > 0) { qzIdx--; qzRefresh(true); }
    else { const i = 'abcd'.indexOf(ev.key.toLowerCase()); const q = list[qzIdx]; if (i >= 0 && ev.key.length === 1 && q && bankAnswers[q.id] === undefined) { const b = document.querySelector(`#q-${q.id} .opt[data-i="${i}"]`); if (b) b.click(); } }
    return;
  }
  if (!exam || exam.finished || parseRoute()[1] !== 'prova' || exam.paused) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) || $('#modal-root').children.length) return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key === 'ArrowRight' && exam.idx < exam.qs.length - 1) { exam.idx++; persistLocalProgress(); router(); }
  else if (ev.key === 'ArrowLeft' && exam.idx > 0) { exam.idx--; persistLocalProgress(); router(); }
  else {
    if (exam.mode === 'treino' && exam.checked[exam.idx]) return;
    const i = 'abcd'.indexOf(ev.key.toLowerCase());
    if (i >= 0 && ev.key.length === 1) { const qid = exam.qs[exam.idx]; if (isCut(qid, i)) toggleCut(qid, i); else exam.answers[exam.idx] = i; persistLocalProgress(); router(); }
  }
});

/* Tema e menu */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = $('#theme-toggle'); btn.innerHTML = `<i data-lucide="${t === 'dark' ? 'sun' : 'moon'}"></i>`; icons();
  if (parseRoute()[0] === 'desempenho') rerenderKeepScroll();
}
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
function closeMenu() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
$('#menu-btn').addEventListener('click', () => { const open = !$('#sidebar').classList.contains('open'); $('#sidebar').classList.toggle('open', open); $('#scrim').classList.toggle('show', open); });
$('#scrim').addEventListener('click', closeMenu);

window.addEventListener('hashchange', router);
/* ================= Contas e sincronização Supabase ================= */
let supabaseClient = null;
try {
  const supabaseUrl = String(window.__SUPABASE_URL__ || '').trim();
  const supabaseKey = String(window.__SUPABASE_ANON_KEY__ || '').trim();
  if (window.supabase && supabaseUrl && supabaseKey) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
} catch (e) {}

let auth = null; // { user: { id, nome, email }, syncedAt, syncing, error }
let syncTimer = null;

function requireSupabase() {
  if (!supabaseClient) throw new Error('Contas ainda não configuradas. Configure a URL e a chave pública do Supabase.');
}

function progressData() { return JSON.parse(exportCode()).data; }
function hasLocalProgress() { return Object.keys(state.attempts).length || state.sims.length || Object.keys(state.read).length || state.sessions.length || state.agenda.length; }

/* Junta o progresso da conta com o da sessão atual, sem perder nada. */
function mergeData(a, b, addAttemptCounts = true) {
  if (!a) return b; if (!b) return a;
  const attempts = Object.assign({}, a.attempts);
  Object.entries(b.attempts || {}).forEach(([k, v]) => {
    const x = attempts[k];
    if (!x) attempts[k] = v;
    else attempts[k] = { n: addAttemptCounts ? x.n + v.n : Math.max(x.n, v.n), ok: addAttemptCounts ? x.ok + v.ok : Math.max(x.ok, v.ok), last: (v.ts || 0) >= (x.ts || 0) ? v.last : x.last, ts: Math.max(x.ts || 0, v.ts || 0) };
  });
  const byKey = (arr, key) => { const m = new Map(); arr.forEach(x => x && m.set(key(x), x)); return [...m.values()]; };
  return {
    attempts,
    sims: byKey([...(a.sims || []), ...(b.sims || [])], x => x.id).sort((x, y) => (x.at || 0) - (y.at || 0)),
    read: Object.assign({}, a.read, b.read),
    sessions: byKey([...(a.sessions || []), ...(b.sessions || [])], x => x.id || x.start).sort((x, y) => x.start - y.start),
    agenda: byKey([...(a.agenda || []), ...(b.agenda || [])], x => x.id || (x.dia + x.hora + x.tipo)),
    metaHoras: b.metaHoras || a.metaHoras || 12,
  };
}

function onSave() { if (!auth) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 900); paintAcct(); }
async function syncNow() {
  if (!auth || !supabaseClient) return;
  clearTimeout(syncTimer);
  auth.syncing = true; paintAcct();
  try {
    const { error } = await supabaseClient.from('user_progress').upsert({
      user_id: auth.user.id,
      data: progressData(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
    auth.syncedAt = Date.now(); auth.error = null; dirty = false;
  } catch (e) {
    auth.error = e.message || 'Não foi possível sincronizar o progresso.';
  }
  if (auth) auth.syncing = false;
  paintAcct();
}
function flushSync() {
  if (auth && (dirty || syncTimer)) void syncNow();
}

async function afterLogin(session, novo = false) {
  if (!session || !session.user) throw new Error('O Supabase não retornou uma sessão válida.');
  const user = session.user;
  const metadata = user.user_metadata || {};
  const sameLocalAccount = localProgressOwnerId === user.id;
  if (localProgressOwnerId && !sameLocalAccount) {
    state = blankState(); bankAnswers = {}; bankReveal = {}; exam = null;
    clearInterval(timerId); dirty = false;
  }
  const local = hasLocalProgress() && (!localProgressOwnerId || sameLocalAccount) ? progressData() : null;
  const googleIdentity = (user.identities || []).find(identity => identity.provider === 'google');
  const identityData = googleIdentity && googleIdentity.identity_data || {};
  auth = {
    user: { id: user.id, nome: metadata.nome || metadata.full_name || metadata.name || user.email || 'Estudante', email: user.email || '', foto: metadata.avatar_url || metadata.picture || identityData.avatar_url || identityData.picture || null },
    syncedAt: null, syncing: false, error: null
  };
  let remote = null;
  try {
    const { data, error } = await supabaseClient.from('user_progress').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    remote = data;
    auth.syncedAt = data && data.updated_at ? new Date(data.updated_at).getTime() : null;
  } catch (e) {
    auth.error = 'Conta conectada, mas a tabela de progresso ainda precisa ser configurada no Supabase.';
  }
  const merged = mergeData(remote && remote.data, local, !sameLocalAccount);
  if (merged) { try { importCode(JSON.stringify({ data: merged })); } catch (e) {} }
  persistLocalProgress();
  router.first = true; router(); paintAcct();
  const gate = $('#modal-root');
  gate.innerHTML = ''; gate.classList.remove('auth-gate');
  if (!auth.error && (local || !remote)) await syncNow();
  toast(novo ? 'Conta criada e progresso sincronizado.' : 'Conta conectada. Progresso carregado.');
}

function showEntryGateIfNeeded() {
  let entryDismissed = false;
  try { entryDismissed = sessionStorage.getItem('caderno-ss:entry-dismissed:v1') === '1'; } catch (e) {}
  if (!entryDismissed && !auth) openLogin('entrar', '', true);
}
async function initializeSupabaseSession() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (data.session) {
        try { await afterLogin(data.session, false); }
        catch (e) { toast('Sessão encontrada, mas não foi possível carregar a conta.'); }
      }
    } catch (e) {
      console.warn('Não foi possível restaurar a sessão Supabase:', e.message);
    }
  }
  authSessionLoading = false;
  paintAcct();
  showEntryGateIfNeeded();
}

/* ----- Cabeçalho ----- */
const initials = n => n.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
function avatarMarkup(user, large = false) {
  let photo = '';
  try { const url = new URL(user.foto || ''); if (url.protocol === 'https:') photo = esc(url.href); } catch (e) {}
  const content = photo ? `<img src="${photo}" alt="" referrerpolicy="no-referrer">` : esc(initials(user.nome));
  return `<span class="mh-avatar${large ? ' lg' : ''}">${content}</span>`;
}
function bindAvatarFallback(root, user) {
  root.querySelectorAll('.mh-avatar img').forEach(img => {
    const fallback = () => { const avatar = img.closest('.mh-avatar'); if (avatar) avatar.textContent = initials(user.nome); };
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && !img.naturalWidth) fallback();
  });
}
let authSessionLoading = true;
function paintAcct() {
  const el = document.getElementById('mh-acct'); if (!el) return;
  if (!auth) { if (authSessionLoading) { el.innerHTML = ''; return; } el.innerHTML = `<button class="mh-login" data-action="open-login" type="button"><i data-lucide="log-in"></i><span>Entrar</span></button>`; icons(); return; }
  const st = auth.syncing ? 'Salvando…' : auth.error ? 'Não salvo' : 'Salvo';
  el.innerHTML = `<button class="mh-user" data-action="open-acct" type="button" aria-haspopup="dialog" title="${esc(auth.user.nome)} · ${st}">
    ${avatarMarkup(auth.user)}<span class="mh-uname">${esc(auth.user.nome.split(' ')[0])}</span><span class="mh-dot ${auth.syncing ? 'busy' : auth.error ? 'err' : 'ok'}" aria-label="${st}"></span></button>`;
  bindAvatarFallback(el, auth.user);
}

/* ----- Instalação como app (PWA) ----- */
let installPrompt = null;
const installButton = document.getElementById('install-app');
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
if (installButton) {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  // Só oferecer o botão customizado quando o navegador puder abrir o prompt nativo.
  // No iOS, a instalação é manual pelo menu Compartilhar do Safari.
  installButton.hidden = isStandalone || !isIOS;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
    toast('Aprovaí instalado no aparelho.');
  });
  installButton.addEventListener('click', async () => {
    if (installPrompt) {
      const promptEvent = installPrompt;
      installPrompt = null;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') installButton.hidden = true;
      return;
    }
    if (isIOS) {
      await modal({ title: 'Instalar Aprovaí', body: 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.', confirm: 'Entendi', cancel: '' });
    }
  });
  icons();
}

/* ----- Diálogo de login / cadastro ----- */
function setupGoogleSignIn(root) {
  const mount = root.querySelector('#google-signin');
  if (!mount) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'google-auth-btn'; button.textContent = 'Continuar com Google';
  button.addEventListener('click', async () => {
    const err = root.querySelector('#auth-err');
    try {
      requireSupabase();
      if (err) err.textContent = '';
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname + location.hash }
      });
      if (error) throw error;
    } catch (e) {
      if (err) err.textContent = e.message || 'Não foi possível iniciar o login Google.';
    }
  });
  mount.replaceChildren(button);
  mount.hidden = false;
}

function openLogin(mode = 'entrar', msg = '', gate = false) {
  const cad = mode === 'cadastro';
  const root = dialogShell(cad ? 'Criar sua conta' : 'Acesse sua conta', `
    <div class="seg auth-tabs" role="tablist">
      <button type="button" class="${cad ? '' : 'on'}" data-auth-tab="entrar" role="tab" aria-selected="${!cad}">Entrar</button>
      <button type="button" class="${cad ? 'on' : ''}" data-auth-tab="cadastro" role="tab" aria-selected="${cad}">Criar conta</button>
    </div>
    <p class="muted small" style="margin:var(--space-3) 0 var(--space-4)">${cad ? 'Crie uma conta para salvar respostas, simulados, cronograma e tempo de estudo e continuar de onde parou em qualquer aparelho.' : 'Entre para carregar o progresso salvo na sua conta.'}</p>
    <div class="google-auth-wrap">
      <div id="google-signin" hidden></div>
      <div class="auth-divider"><span>ou use seu e-mail</span></div>
    </div>
    <form id="auth-form" class="auth-form" novalidate>
      ${cad ? '<div class="fg"><label for="au-nome">Nome</label><input class="input" id="au-nome" name="nome" autocomplete="name" required maxlength="80"></div>' : ''}
      <div class="fg"><label for="au-email">E-mail</label><input class="input" id="au-email" name="email" type="email" autocomplete="email" required maxlength="160"></div>
      <div class="fg"><label for="au-senha">Senha</label><input class="input" id="au-senha" name="senha" type="password" autocomplete="${cad ? 'new-password' : 'current-password'}" required minlength="6"></div>
      ${cad ? '<p class="xs muted" style="margin:0">Mínimo de 6 caracteres.</p>' : ''}
      <p class="auth-err" id="auth-err" role="alert">${esc(msg)}</p>
      ${hasLocalProgress() ? '<p class="xs muted" style="margin:0">O progresso feito nesta visita será somado ao da conta.</p>' : ''}
      <div class="btn-row" style="justify-content:flex-end">
        ${gate ? '<button type="button" class="btn btn-ghost" data-guest-entry>Continuar como visitante</button>' : '<button type="button" class="btn" data-close="1">Cancelar</button>'}
        <button type="submit" class="btn btn-primary" id="auth-go">${cad ? 'Criar conta' : 'Entrar'}</button>
      </div>
    </form>`, { gate });
  root.querySelectorAll('[data-auth-tab]').forEach(b => b.addEventListener('click', () => openLogin(b.dataset.authTab, '', gate)));
  const guestEntry = root.querySelector('[data-guest-entry]');
  if (guestEntry) guestEntry.addEventListener('click', () => {
    try { sessionStorage.setItem('caderno-ss:entry-dismissed:v1', '1'); } catch (e) {}
    root.innerHTML = '';
    root.classList.remove('auth-gate');
  });
  setupGoogleSignIn(root);
  const f = root.querySelector('#auth-form');
  f.addEventListener('input', () => { const e = root.querySelector('#auth-err'); if (e) e.textContent = ''; });
  (root.querySelector(cad ? '#au-nome' : '#au-email')).focus();
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = root.querySelector('#auth-err'), go = root.querySelector('#auth-go');
    const v = Object.fromEntries(new FormData(f).entries());
    if (cad && (!v.nome || v.nome.trim().length < 2)) { err.textContent = 'Informe seu nome.'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || '')) { err.textContent = 'Informe um e-mail válido.'; return; }
    if (!v.senha || v.senha.length < 6) { err.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    go.disabled = true; go.textContent = cad ? 'Criando…' : 'Entrando…'; err.textContent = '';
    try {
      requireSupabase();
      if (cad) {
        const { data, error } = await supabaseClient.auth.signUp({ email: v.email, password: v.senha, options: { data: { nome: v.nome.trim() }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.session) await afterLogin(data.session, true);
        else {
          err.textContent = 'Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.';
          go.disabled = false; go.textContent = 'Criar conta';
        }
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: v.email, password: v.senha });
        if (error) throw error;
        await afterLogin(data.session, false);
      }
    } catch (e) { err.textContent = e.message; go.disabled = false; go.textContent = cad ? 'Criar conta' : 'Entrar'; }
  });
}

function openAcct() {
  const when = auth.syncedAt ? new Date(auth.syncedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const all = statsFor(() => true);
  const root = dialogShell('Minha conta', `
    <div class="acct-card">
      ${avatarMarkup(auth.user, true)}
      <div><b>${esc(auth.user.nome)}</b><div class="small muted">${esc(auth.user.email)}</div></div>
    </div>
    <table class="tbl" style="margin:var(--space-4) 0"><tbody>
      <tr><td class="k">Sincronização</td><td>${auth.syncing ? 'Salvando…' : auth.error ? `<span class="pct low">Não salvo: ${esc(auth.error)}</span>` : when ? 'Salvo às ' + when : 'Aguardando a primeira alteração'}</td></tr>
      <tr><td class="k">Questões resolvidas</td><td class="tnum">${all.seen} de ${all.total}</td></tr>
      <tr><td class="k">Simulados</td><td class="tnum">${state.sims.length}</td></tr>
      <tr><td class="k">Sessões de estudo</td><td class="tnum">${state.sessions.length}</td></tr>
    </tbody></table>
    <p class="xs muted">O progresso fica salvo neste aparelho e sincroniza com sua conta. Em outro aparelho, entre com esta conta para recuperar os dados.</p>
    <div class="btn-row" style="justify-content:flex-end">
      <button class="btn" id="acct-sync">Salvar agora</button>
      <button class="btn btn-danger-ghost" id="acct-out">Sair</button>
      <button class="btn btn-primary" data-close="1">Fechar</button>
    </div>`);
  bindAvatarFallback(root, auth.user);
  root.querySelector('#acct-sync').addEventListener('click', async () => { await syncNow(); root.innerHTML = ''; toast(auth && !auth.error ? 'Progresso salvo.' : 'Não foi possível salvar agora.'); });
  root.querySelector('#acct-out').addEventListener('click', async () => {
    await syncNow();
    try { if (supabaseClient) await supabaseClient.auth.signOut(); } catch (e) {}
    auth = null; state = blankState(); bankAnswers = {}; bankReveal = {}; exam = null; clearInterval(timerId); clearLocalProgress(); dirty = false;
    root.innerHTML = ''; router.first = true; router(); paintAcct(); toast('Você saiu da conta. O progresso continua salvo nela.');
  });
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action="open-login"], [data-action="open-acct"]');
  if (!el) return;
  ev.preventDefault();
  if (el.dataset.action === 'open-acct' && auth) openAcct(); else openLogin(el.dataset.mode || 'entrar');
});


window.addEventListener('beforeunload', ev => { if (typeof auth !== 'undefined' && auth) { flushSync(); if (!sw) return; } if (sw || (dirty && (Object.keys(state.attempts).length || state.sims.length || state.sessions.length || state.agenda.length))) { ev.preventDefault(); ev.returnValue = ''; } });
setInterval(() => { renderMast(); icons(); }, 60000);
const restoredLocalProgress = restoreLocalProgress();
setTheme(document.documentElement.getAttribute('data-theme'));
paintAcct();
router();
if (restoredLocalProgress) toast('Progresso recuperado deste aparelho.');
void initializeSupabaseSession();
})();

