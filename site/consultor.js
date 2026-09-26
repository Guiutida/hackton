import { PLANOS, recomendar } from "./planos.js";

const QUIZ = [
  { id: "modo", q: "Olá! Sou o assistente virtual da ETECC. Atendo vendas e suporte, 24 horas por dia. O que você precisa hoje?", opts: [["vendas", "Contratar internet"], ["suporte", "Já sou cliente: suporte ou financeiro"]] },
  { id: "local", q: "Ótimo! Em 1 minuto encontro o plano ideal para você. Para onde é a internet?", opts: [["casa", "Minha casa"], ["empresa", "Minha empresa"]] },
  { id: "pessoas", q: "Quantas pessoas usam a internet na sua casa?", opts: [["1-2", "1 a 2"], ["3-4", "3 a 4"], ["5+", "5 ou mais"]] },
  { id: "uso", q: "O que mais pesa no seu uso?", opts: [["basico", "Redes sociais e vídeos"], ["streaming", "Streaming em várias TVs"], ["homeoffice", "Home office e videochamadas"], ["games", "Jogos online"]] },
  { id: "assistencia", q: "Quer Telemedicina e manutenção residencial inclusas no plano?", opts: [["sim", "Sim, quero"], ["nao", "Não precisa"]] },
];
const STATUS = { ia: "Inteligência artificial · 24h", fila: "Chamando um atendente humano...", humano: "Atendente humano · ao vivo", encerrado: "Atendimento encerrado" };
const TIPO_CHAMADO = { visita_tecnica: "Visita técnica", upgrade_plano: "Upgrade de plano", mudanca_endereco: "Mudança de endereço", outro: "Chamado" };
const PAGINA = "/atendimento";

const root = document.getElementById("consultor-chat");
const full = root.dataset.mode === "full"; // tela cheia (/atendimento); na home o widget é só a porta de entrada
root.innerHTML = full
  ? `<header class="ec-top"><a href="/" class="ec-back" aria-label="Voltar ao site">‹</a><img src="/images/logo-etecc.png" alt="ETECC Telecom"><button type="button" class="ec-reset" aria-label="Nova conversa" title="Nova conversa">+</button></header>
     <div class="ec-sub"><span class="ec-status"></span><small></small></div>
     <div class="ec-msgs"></div>
     <div class="ec-bottom"><div class="ec-opts"></div><form class="ec-form"><input type="text" autocomplete="off" enterkeyhint="send"><button type="submit" aria-label="Enviar">➤</button></form><p class="ec-foot">Protótipo de hackathon. Para testar o suporte use os telefones 13 99999-0001 a 0004.</p></div>`
  : `<div class="ec-head"><span class="ec-status"></span><div><strong>Assistente ETECC</strong><small></small></div></div>
     <div class="ec-msgs"></div>
     <div class="ec-opts"></div>
     <form class="ec-form"><input type="text" autocomplete="off" placeholder="Ou escreva sua dúvida..."><button type="submit">Enviar</button></form>
     <p class="ec-foot">A conversa abre em tela cheia. Protótipo de hackathon.</p>`;
const $ = (s) => root.querySelector(s);
const msgs = $(".ec-msgs"), opts = $(".ec-opts"), form = $(".ec-form"), input = form.querySelector("input"), sendBtn = form.querySelector("button"), sub = $(".ec-head small, .ec-sub small");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const brl = (v) => "R$ " + v.toFixed(2).replace(".", ",");
const linkify = (t) => esc(t).replace(/https?:\/\/\S+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, "<br>");

let state, timer;

function bubble(role, html) {
  const d = document.createElement("div");
  d.className = "ec-msg ec-" + role;
  d.innerHTML = html;
  msgs.append(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}
const text = (role, t) => bubble(role, linkify(t));

function setInput(on, placeholder) {
  if (!full) return; // na home o campo fica sempre livre: qualquer envio abre a tela cheia
  input.disabled = sendBtn.disabled = !on;
  input.placeholder = placeholder || (on ? "Digite sua mensagem..." : "Escolha uma opção acima");
  if (on && matchMedia("(pointer:fine)").matches) input.focus(); // no celular não abre o teclado sozinho
}

function ask() {
  const step = QUIZ[state.step];
  text("bot", step.q);
  opts.innerHTML = "";
  for (const [value, label] of step.opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = () => answer(step, value, label);
    opts.append(b);
  }
}

function answer(step, value, label) {
  if (!full) return location.assign(`${PAGINA}?opt=${value}`);
  opts.innerHTML = "";
  text("user", label);
  state.perfil[step.id] = value;
  state.step++;
  if (value === "suporte" || value === "empresa") return send(null);
  if (state.step < QUIZ.length) return ask();
  const p = PLANOS[(state.perfil.plano = recomendar(state.perfil))];
  bubble("bot", `<div class="ec-plan"><small>Seu plano ideal</small><strong>${esc(p.nome)}</strong><span class="ec-price">${brl(p.preco)}<em>/mês</em></span><ul>${p.beneficios.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`);
  send(null);
}

const card = (classe, titulo, cabecalho, itens) => `<div class="ec-plan ${classe}"><small>${titulo}</small><strong>${esc(cabecalho)}</strong><ul>${itens.filter(Boolean).map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;

function render({ sessionId, status, entries, total }) {
  state.sessionId = sessionId;
  state.seen = total;
  for (const e of entries) {
    if (e.de === "cliente") continue; // já mostrado na hora do envio
    if (e.de === "ia") text("bot", e.texto);
    else if (e.de === "atendente") bubble("bot ec-humano", `<small>Atendente ETECC</small>${linkify(e.texto)}`);
    else if (e.tipo === "pedido") bubble("bot", card("ec-ok", "Pedido registrado", `Protocolo ${e.protocolo}`, [e.plano, e.endereco, "Instalação: " + e.instalacao]));
    else if (e.tipo === "chamado") bubble("bot", card("ec-ok", "Chamado aberto", `Protocolo ${e.protocolo}`, [TIPO_CHAMADO[e.tipo_chamado] || "Chamado", e.descricao, e.agendamento && "Agendado: " + e.agendamento]));
    else if (e.tipo === "fila") bubble("bot ec-humano", `<small>Atendente humano</small>${esc(e.texto)}`);
    else text("bot", e.texto);
  }
  if (status !== state.status) { state.status = status; sub.textContent = STATUS[status]; }
  clearInterval(timer);
  if (status === "encerrado") return setInput(false, "Atendimento encerrado. Toque em + para começar de novo.");
  if (status !== "ia") timer = setInterval(sync, 3000); // atendente humano responde pelo painel
  setInput(true);
}

async function sync() {
  const r = await fetch(`/api/sessoes/${state.sessionId}?since=${state.seen}`);
  if (r.ok) render(await r.json());
}

async function send(userText) {
  if (userText) text("user", userText);
  setInput(false, "Aguarde...");
  opts.innerHTML = "";
  const typing = state.status === "ia" ? bubble("bot", '<span class="ec-typing"><i></i><i></i><i></i></span>') : null;
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: state.sessionId, perfil: state.perfil, text: userText, since: state.seen }) });
    if (!r.ok) throw new Error(await r.text());
    typing?.remove();
    render(await r.json());
  } catch (e) {
    console.error(e);
    typing?.remove();
    text("bot", "Não consegui falar com o servidor. Tente de novo em instantes ou ligue (13) 3421-1999.");
    setInput(true);
  }
}

function reset() {
  clearInterval(timer);
  state = { step: 0, perfil: {}, sessionId: null, status: "ia", seen: 0 };
  sub.textContent = STATUS.ia;
  msgs.innerHTML = "";
  setInput(true);
  ask();
}

form.onsubmit = (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t) return;
  if (!full) return location.assign(`${PAGINA}?q=${encodeURIComponent(t)}`);
  input.value = "";
  if (state.step < QUIZ.length && !state.sessionId) { // escreveu em vez de escolher uma opção: a IA descobre o que ele precisa
    state.perfil = { modo: "livre" };
    state.step = QUIZ.length;
    opts.innerHTML = "";
  }
  send(t);
};
$(".ec-reset") && ($(".ec-reset").onclick = () => { reset(); history.replaceState(null, "", PAGINA); });
reset();

if (full) {
  // chegou da home com a primeira escolha ou mensagem na URL
  const p = new URLSearchParams(location.search);
  const opt = QUIZ[0].opts.find(([v]) => v === p.get("opt"));
  if (opt) answer(QUIZ[0], opt[0], opt[1]);
  else if (p.get("q")) { msgs.innerHTML = ""; input.value = p.get("q"); form.requestSubmit(); }
  history.replaceState(null, "", PAGINA);
} else if (document.querySelector("main > astro-island")) {
  // A home é uma ilha React (BlockRenderer); a seção fica fora dela no HTML e só é movida
  // para antes de "Sobre" depois que o React hidratou de fato (nó ganha __reactFiber$),
  // senão o React detecta mismatch e descarta a seção. Se não hidratar em 5s, fica no fim do main.
  const sec = document.getElementById("consultor");
  const hidratado = () => { const s = document.getElementById("sobre"); return s && Object.keys(s).some((k) => k.startsWith("__reactFiber")); };
  let tentativas = 0;
  const mover = setInterval(() => {
    if (hidratado()) document.getElementById("sobre").before(sec);
    if (hidratado() || ++tentativas > 50) clearInterval(mover);
  }, 100);

  document.body.insertAdjacentHTML("beforeend", `<a href="${PAGINA}" class="ec-launch"><span class="ec-launch-av">IA</span><span><strong>Fale com a ETECC</strong><small>IA · 24h · sem fila</small></span></a>`);
  const launch = document.querySelector(".ec-launch");
  new IntersectionObserver(([e]) => (launch.style.display = e.isIntersecting ? "none" : ""), { threshold: 0.35 }).observe(sec);
}
