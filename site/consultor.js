const SAUDACAO = "Olá! Sou o assistente virtual da ETECC. Posso resolver problemas da sua internet, tirar dúvidas, emitir a 2ª via da fatura ou contratar um plano. Como posso ajudar?";
const SUGESTOES = ["Minha internet está lenta", "Estou sem internet", "Quero contratar um plano", "2ª via da fatura", "Trocar a senha do Wi-Fi", "Falar com um atendente"];
const STATUS = { ia: "Inteligência artificial · 24h", fila: "Chamando um atendente humano...", humano: "Atendente humano · ao vivo", encerrado: "Atendimento encerrado" };
const TIPO_CHAMADO = { visita_tecnica: "Visita técnica", upgrade_plano: "Upgrade de plano", mudanca_endereco: "Mudança de endereço", outro: "Chamado" };
const PAGINA = "/atendimento";
const LOGO = '<img src="/images/logo-etecc.png" alt="ETECC">';

const root = document.getElementById("consultor-chat");
const full = root.dataset.mode === "full"; // tela cheia (/atendimento); na home o widget é só a porta de entrada
root.innerHTML = full
  ? `<aside class="ec-side">
       <div class="ec-side-head"><span class="ec-tile">${LOGO}</span><button type="button" class="ec-side-close" aria-label="Fechar menu">×</button></div>
       <button type="button" class="ec-new">+ Nova conversa</button>
       <p class="ec-hist-title">Histórico</p>
       <ul class="ec-hist"></ul>
       <p class="ec-side-foot">Protótipo de hackathon. Para testar como cliente use os telefones 13 99999-0001 a 0004.</p>
     </aside>
     <div class="ec-backdrop"></div>
     <section class="ec-main">
       <header class="ec-top"><button type="button" class="ec-menu" aria-label="Histórico">☰</button><div class="ec-title"><strong>Assistente ETECC</strong><small></small></div><button type="button" class="ec-reset" aria-label="Nova conversa" title="Nova conversa">+</button></header>
       <div class="ec-msgs"></div>
       <div class="ec-bottom"><form class="ec-form"><input type="text" autocomplete="off" enterkeyhint="send" placeholder="Pergunte alguma coisa"><button type="submit" aria-label="Enviar">➤</button></form><p class="ec-foot">A IA pode errar. Confira informações importantes com um atendente.</p></div>
     </section>`
  : `<div class="ec-head"><span class="ec-status"></span><div><strong>Assistente ETECC</strong><small></small></div></div>
     <div class="ec-msgs"></div>
     <div class="ec-opts"></div>
     <form class="ec-form"><input type="text" autocomplete="off" placeholder="Escreva sua dúvida ou problema..."><button type="submit">Enviar</button></form>
     <p class="ec-foot">A conversa abre em tela cheia. Protótipo de hackathon.</p>`;
const $ = (s) => root.querySelector(s);
const msgs = $(".ec-msgs"), form = $(".ec-form"), input = form.querySelector("input"), sendBtn = form.querySelector("button"), sub = $(".ec-head small, .ec-title small");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const linkify = (t) => esc(t).replace(/https?:\/\/[^\s)]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, "<br>");

// histórico de conversas deste navegador (as conversas em si ficam no servidor)
const HIST = "ec-hist";
const hist = {
  get: () => { try { return JSON.parse(localStorage.getItem(HIST)) || []; } catch { return []; } },
  set: (v) => { try { localStorage.setItem(HIST, JSON.stringify(v)); } catch {} },
};

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
  input.placeholder = placeholder || (on ? "Pergunte alguma coisa" : "Aguarde...");
  if (on && matchMedia("(pointer:fine)").matches) input.focus(); // no celular não abre o teclado sozinho
}

function sugestoes(container) {
  container.innerHTML = "";
  for (const s of SUGESTOES) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.onclick = () => send(s);
    container.append(b);
  }
}

const card = (classe, titulo, cabecalho, itens) => `<div class="ec-plan ${classe}"><small>${titulo}</small><strong>${esc(cabecalho)}</strong><ul>${itens.filter(Boolean).map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;

function render({ sessionId, status, entries, total }, tudo = false) {
  state.sessionId = sessionId;
  state.seen = total;
  for (const e of entries) {
    if (e.de === "cliente") { if (tudo) text("user", e.texto); continue; } // ao vivo já foi mostrado na hora do envio
    if (e.de === "ia") text("bot", e.texto);
    else if (e.de === "atendente") bubble("bot ec-humano", `<small>Atendente ETECC</small>${linkify(e.texto)}`);
    else if (e.tipo === "confirmar") bubble("bot", card("ec-conf", "Confira seu pedido", e.plano, [e.nome, e.telefone, e.endereco, "Instalação: " + e.instalacao]) + '<div class="ec-conf-btns"><button type="button" data-acao="confirmar">Confirmar pedido</button><button type="button" data-acao="corrigir">Corrigir dados</button></div>');
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
  if (!full) return location.assign(`${PAGINA}?q=${encodeURIComponent(userText)}`);
  $(".ec-empty")?.remove();
  text("user", userText);
  setInput(false);
  const typing = state.status === "ia" ? bubble("bot", '<span class="ec-typing"><i></i><i></i><i></i></span>') : null;
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: state.sessionId, text: userText, since: state.seen }) });
    if (!r.ok) throw new Error(await r.text());
    typing?.remove();
    render(await r.json());
    if (!hist.get().some((h) => h.id === state.sessionId)) { // primeira mensagem: entra no histórico
      hist.set([{ id: state.sessionId, titulo: userText.slice(0, 48), criado: Date.now() }, ...hist.get()].slice(0, 30));
      renderHist();
    }
  } catch (e) {
    console.error(e);
    typing?.remove();
    text("bot", "Não consegui falar com o servidor. Tente de novo em instantes ou ligue (13) 3421-1999.");
    setInput(true);
  }
}

function reset() {
  clearInterval(timer);
  state = { sessionId: null, status: "ia", seen: 0 };
  sub.textContent = STATUS.ia;
  msgs.innerHTML = "";
  if (full) {
    msgs.innerHTML = `<div class="ec-empty"><span class="ec-tile ec-tile-lg">${LOGO}</span><h1>Como posso ajudar?</h1><p>Problemas de conexão, fatura, dúvidas sobre planos ou contratação.</p><div class="ec-opts"></div></div>`;
    sugestoes($(".ec-empty .ec-opts"));
    renderHist();
  } else {
    text("bot", SAUDACAO);
    sugestoes($(".ec-opts"));
  }
  setInput(true);
}

// ----- histórico (só na tela cheia) -----
function renderHist() {
  const ul = $(".ec-hist");
  if (!ul) return;
  const lista = hist.get();
  ul.innerHTML = lista.length ? "" : '<li class="vazio">Suas conversas aparecem aqui.</li>';
  for (const h of lista) {
    const li = document.createElement("li");
    li.textContent = h.titulo;
    li.title = new Date(h.criado).toLocaleString("pt-BR");
    if (h.id === state.sessionId) li.className = "sel";
    li.onclick = () => carregar(h.id);
    ul.append(li);
  }
}

async function carregar(id) {
  root.classList.remove("side-open");
  if (id === state.sessionId) return;
  const r = await fetch(`/api/sessoes/${id}?since=0`);
  if (!r.ok) { // servidor reiniciou: a conversa não existe mais
    hist.set(hist.get().filter((h) => h.id !== id));
    reset();
    text("bot", "Essa conversa expirou no servidor. Pode começar uma nova por aqui.");
    return;
  }
  clearInterval(timer);
  state = { sessionId: id, status: "ia", seen: 0 };
  msgs.innerHTML = "";
  render(await r.json(), true);
  renderHist();
}

form.onsubmit = (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t) return;
  input.value = "";
  send(t);
};
msgs.onclick = async (ev) => { // botões do cartão "Confira seu pedido"
  const b = ev.target.closest("[data-acao]");
  if (!b) return;
  b.parentElement.querySelectorAll("button").forEach((x) => (x.disabled = true));
  text("user", b.textContent);
  setInput(false);
  const typing = bubble("bot", '<span class="ec-typing"><i></i><i></i><i></i></span>');
  const r = await fetch(`/api/sessoes/${state.sessionId}/${b.dataset.acao}?since=${state.seen}`, { method: "POST" });
  typing.remove();
  if (r.ok) render(await r.json()); else setInput(true);
};
reset();

if (full) {
  const nova = () => { reset(); root.classList.remove("side-open"); history.replaceState(null, "", PAGINA); };
  $(".ec-reset").onclick = nova;
  $(".ec-new").onclick = nova;
  $(".ec-menu").onclick = () => root.classList.add("side-open");
  $(".ec-side-close").onclick = $(".ec-backdrop").onclick = () => root.classList.remove("side-open");
  // chegou da home com a primeira mensagem na URL
  const q = new URLSearchParams(location.search).get("q");
  if (q) send(q);
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
