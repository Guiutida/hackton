import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PLANOS, EMPRESA } from "./site/planos.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(ROOT, "site");
const REGISTROS = path.join(ROOT, "registros.json"); // pedidos e chamados: o "CRM" da demo
const PIX = "https://pix.eteccnet.com.br/login";

// carrega .env (Node 18 não tem --env-file)
try {
  for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
const PORT = process.env.PORT || 3000;
// Provedor: OpenAI se OPENAI_API_KEY existir; senão OpenRouter com modelos gratuitos (o primeiro é o principal, os demais fallback automático).
const MODELOS_OR = (process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free,qwen/qwen3.8-27b:free").split(",");
// OpenAI: nano é o mais barato da família (troque por gpt-5.4-mini se o fluxo ficar impreciso);
// gpt-5.x só aceita ferramentas no chat/completions com reasoning_effort "none".
const PROVEDOR = process.env.OPENAI_API_KEY
  ? { nome: "OpenAI", url: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY, modelo: process.env.OPENAI_MODEL || "gpt-5.4-nano", extra: { max_completion_tokens: 1024, ...(/^gpt-5\.[1-9]/.test(process.env.OPENAI_MODEL || "gpt-5.4-nano") ? { reasoning_effort: "none" } : {}) } } // gpt-4.1 não aceita reasoning_effort; gpt-5 (sem ponto) só aceita minimal e não chama ferramentas direito
  : { nome: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, modelo: MODELOS_OR[0], extra: { models: MODELOS_OR.slice(1), temperature: 0.3, max_tokens: 1024 } };

// ---------- dados mockados ----------
// ponytail: cobertura e cadastro em listas fixas; trocar pela API do ERP (MK Solutions)
const norm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const BAIRROS_PG = ["boqueirao", "guilhermina", "aviacao", "tupi", "ocian", "caicara", "canto do forte", "forte", "mirim", "maracana", "vila sonia", "real", "ribeiropolis", "melvi", "sitio do campo", "solemar", "jardim imperador", "antartica", "florida", "xixova"];
const EM_EXPANSAO = ["quietude", "samambaia", "anhanguera"];

export function consultarCobertura({ cep = "", bairro = "", rua = "" }) {
  const b = norm(bairro + " " + rua);
  const digits = cep.replace(/\D/g, "");
  if (EM_EXPANSAO.some((x) => b.includes(x))) return { coberto: false, status: "em_expansao", cidade: "Praia Grande", previsao: "rede chega nos próximos 60 dias" };
  if (BAIRROS_PG.some((x) => b.includes(x)) || /^117[0-2]/.test(digits)) return { coberto: true, cidade: "Praia Grande", tecnologia: "fibra óptica FTTH" };
  if (/^117[3-5]/.test(digits)) return { coberto: true, cidade: "Mongaguá, Itanhaém ou Peruíbe", tecnologia: "fibra óptica FTTH" };
  return { coberto: false, status: "fora_da_area" };
}

const CLIENTES = [
  { telefone: "13999990001", contrato: "48213", nome: "Maria Souza", plano: "600 MEGA", endereco: "Rua Jaú, 120, Boqueirão, Praia Grande", status: "ativo", fatura: { valor: 109.9, vencimento: "10/10/2026", situacao: "em aberto", pagar_em: PIX }, conexao: { onu: "online", sinal_optico: "-19 dBm (normal)", manutencao_programada: null } },
  { telefone: "13999990002", contrato: "51877", nome: "João Lima", plano: "800 MEGA", endereco: "Av. Presidente Kennedy, 5000, Guilhermina, Praia Grande", status: "bloqueado por fatura vencida", fatura: { valor: 129.9, vencimento: "25/09/2026", situacao: "vencida", pagar_em: PIX }, conexao: { onu: "online", sinal_optico: "-20 dBm (normal)", manutencao_programada: null } },
  { telefone: "13999990003", contrato: "60342", nome: "Ana Pereira", plano: "ETECC GAMER 1000 MEGA", endereco: "Rua Guarujá, 77, Vila Caiçara, Praia Grande", status: "ativo", fatura: { valor: 169.9, vencimento: "15/10/2026", situacao: "paga" }, conexao: { onu: "offline há 40 minutos", sinal_optico: "sem sinal", manutencao_programada: null } },
  { telefone: "13999990004", contrato: "39120", nome: "Carlos Mendes", plano: "ETECC PREMIUM 1000 MEGA", endereco: "Rua Ipanema, 310, Tupi, Praia Grande", status: "ativo", fatura: { valor: 149.9, vencimento: "05/10/2026", situacao: "em aberto", pagar_em: PIX }, conexao: { onu: "online", sinal_optico: "-18 dBm (normal)", manutencao_programada: "manutenção programada no bairro Tupi hoje das 14h às 16h" } },
];

export function consultarCliente({ telefone = "", contrato = "" }) {
  const tel = String(telefone).replace(/\D/g, "").replace(/^55/, "");
  const num = String(contrato).replace(/\D/g, "");
  const c = CLIENTES.find((x) => (tel && x.telefone === tel) || (num && x.contrato === num));
  return c || { encontrado: false, dica: "confira o telefone cadastrado com DDD ou o número do contrato" };
}

function registrar(reg) {
  const lista = fs.existsSync(REGISTROS) ? JSON.parse(fs.readFileSync(REGISTROS, "utf8")) : [];
  const protocolo = "ETC-" + String(lista.length + 1).padStart(4, "0");
  lista.push({ ...reg, protocolo, data: new Date().toISOString() }); // protocolo por último: reg pode trazer protocolo null
  fs.writeFileSync(REGISTROS, JSON.stringify(lista, null, 2));
  return protocolo;
}

// ---------- sessões ----------
// ponytail: sessões em memória, somem ao reiniciar; persistir se virar produto
const sessoes = new Map();
const brl = (v) => "R$ " + v.toFixed(2).replace(".", ",");

function seed(perfil) {
  if (perfil.modo === "suporte") return "Cliente existente pedindo suporte. Inicie o atendimento de suporte.";
  if (perfil.modo === "livre") return "Cliente entrou pelo site e escreveu por conta própria, sem escolher vendas ou suporte. Descubra pela mensagem se é cliente novo (vendas) ou cliente existente (suporte) e siga o fluxo correspondente. Se ele já informou CEP ou bairro, verifique a cobertura antes de qualquer outra pergunta; se informou telefone ou contrato, consulte o cadastro. A mensagem dele vem a seguir.";
  const plano = PLANOS[perfil.plano];
  return `Cliente novo. Perfil do quiz: ${JSON.stringify(perfil)}.${plano ? ` Plano recomendado: ${plano.nome} por ${brl(plano.preco)}/mês.` : ""} Inicie o atendimento de vendas.`;
}

function novaSessao(perfil) {
  const s = { id: crypto.randomUUID().slice(0, 8), perfil, status: "ia", criado: new Date().toISOString(), messages: [{ role: "user", content: seed(perfil) }], log: [] };
  sessoes.set(s.id, s);
  return s;
}

const estado = (s, since = 0) => ({ sessionId: s.id, status: s.status, modo: s.perfil.modo, motivo: s.motivo, resumo: s.resumo, perfil: s.perfil, entries: s.log.slice(since), total: s.log.length });

// ---------- IA (OpenRouter, formato OpenAI) ----------
const tools = [
  {
    name: "consultar_cobertura",
    description: "Verifica se a fibra ETECC chega no endereço de um cliente novo. Chame assim que tiver o CEP ou o bairro.",
    parameters: { type: "object", properties: { cep: { type: "string" }, bairro: { type: "string" }, rua: { type: "string" } } },
  },
  {
    name: "finalizar_pedido",
    description: "Registra a contratação de um cliente novo. Só chame depois que a cobertura foi confirmada e o cliente confirmou o resumo dos dados. Retorna o protocolo.",
    parameters: {
      type: "object",
      properties: { nome: { type: "string" }, telefone: { type: "string" }, endereco: { type: "string" }, bairro: { type: "string" }, cep: { type: "string" }, plano: { type: "string" }, instalacao: { type: "string", description: "dia e período preferidos" } },
      required: ["nome", "telefone", "endereco", "plano", "instalacao"],
    },
  },
  {
    name: "consultar_cliente",
    description: "Busca o cadastro de um cliente existente pelo telefone cadastrado (com DDD) ou pelo número do contrato. Retorna plano, endereço, status do contrato, fatura e diagnóstico da conexão.",
    parameters: { type: "object", properties: { telefone: { type: "string" }, contrato: { type: "string" } } },
  },
  {
    name: "abrir_chamado",
    description: "Abre um chamado para um cliente já identificado: visita_tecnica, upgrade_plano, mudanca_endereco ou outro. Retorna o protocolo.",
    parameters: {
      type: "object",
      properties: { contrato: { type: "string" }, tipo: { type: "string", enum: ["visita_tecnica", "upgrade_plano", "mudanca_endereco", "outro"] }, descricao: { type: "string" }, agendamento: { type: "string", description: "dia e período combinados, se houver" } },
      required: ["contrato", "tipo", "descricao"],
    },
  },
  {
    name: "encaminhar_atendente",
    description: "Transfere a conversa para um atendente humano, que continua neste mesmo chat com o histórico. Use quando: sem cobertura ou em expansão, plano empresarial, cancelamento, contestação de cobrança, reclamação formal, ou quando o cliente pede uma pessoa. Depois de chamar, encerre sua participação.",
    parameters: { type: "object", properties: { motivo: { type: "string" }, resumo: { type: "string", description: "tudo que já foi coletado e o que o atendente precisa fazer" } }, required: ["motivo", "resumo"] },
  },
].map((f) => ({ type: "function", function: f }));

function runTool(s, name, input) {
  switch (name) {
    case "consultar_cobertura": return consultarCobertura(input);
    case "consultar_cliente": return consultarCliente(input);
    case "finalizar_pedido": {
      const protocolo = registrar({ tipo: "pedido", sessao: s.id, ...input });
      s.log.push({ de: "sistema", tipo: "pedido", protocolo, ...input });
      return { status: "confirmado", protocolo };
    }
    case "abrir_chamado": {
      const reg = { ...input, tipo: "chamado", tipo_chamado: input.tipo, protocolo: null }; // input.tipo é o subtipo (visita_tecnica...)
      reg.protocolo = registrar({ ...reg, sessao: s.id });
      s.log.push({ de: "sistema", ...reg });
      return { status: "aberto", protocolo: reg.protocolo };
    }
    case "encaminhar_atendente": {
      s.status = "fila"; s.motivo = input.motivo; s.resumo = input.resumo;
      s.log.push({ de: "sistema", tipo: "fila", texto: "Você entrou na fila de um atendente humano. Ele continua por aqui mesmo, já com o seu histórico." });
      return { status: "na_fila", posicao: 1, espera_estimada: "2 minutos" };
    }
    default: return { erro: `ferramenta desconhecida: ${name}` };
  }
}

const SYSTEM = `Você é o assistente virtual da ETECC Telecom, provedor de internet fibra óptica do litoral sul paulista (Praia Grande, Mongaguá, Itanhaém e Peruíbe), com mais de 27 anos de mercado. Você atende dentro do site da empresa, 24 horas, em vendas e suporte. Um atendente humano assume esta mesma conversa quando você chama encaminhar_atendente.

Planos residenciais (mensal):
${Object.values(PLANOS).map((p) => `- ${p.nome}: ${brl(p.preco)}. ${p.beneficios.join(", ")}.`).join("\n")}
Todos: instalação grátis, sem fidelidade, equipamento em comodato, atendimento 24h.
Planos empresariais (sempre fechados por atendente humano):
${EMPRESA.map((e) => "- " + e).join("\n")}
Lojas em Praia Grande, Mongaguá, Itanhaém e Peruíbe. Telefone (13) 3421-1999. Pagamento por Pix: ${PIX}

MODO VENDAS (a primeira mensagem diz "Cliente novo"):
1. Confirme o plano recomendado em uma frase e peça o CEP (ou rua e bairro) para verificar a cobertura. Se ainda não houver plano recomendado (cliente que escreveu livremente), pergunte quantas pessoas usam a internet e o principal uso, e recomende assim: jogos online = GAMER; assistência familiar ou 5 ou mais pessoas = PREMIUM; 3 a 4 pessoas, streaming ou home office = 800 MEGA; senão 600 MEGA.
2. Com CEP ou bairro, chame consultar_cobertura.
3. Com cobertura: colete, uma pergunta por vez, nome completo, telefone, endereço completo com número, e melhor dia e período para a instalação. Mostre um resumo curto e peça confirmação. Só depois do sim chame finalizar_pedido e informe o protocolo.
4. Sem cobertura ou em expansão: chame encaminhar_atendente com o resumo para registrar o interesse.
5. Empresa: pergunte nome, empresa, telefone e a necessidade, sugira o plano empresarial que encaixa e chame encaminhar_atendente.

MODO SUPORTE (a primeira mensagem diz "Cliente existente"):
1. Pergunte o que aconteceu e peça o telefone cadastrado com DDD ou o número do contrato. Chame consultar_cliente. Não revele dados de cadastro antes de localizar o cliente.
2. Conexão: se o status do contrato for bloqueado por fatura vencida, explique que a internet volta sozinha em até 15 minutos após o pagamento e passe o link do Pix. Se a ONU estiver offline ou sem sinal, oriente a tirar o equipamento da tomada por 30 segundos e aguardar 3 minutos; se não resolver, chame abrir_chamado tipo visita_tecnica com o dia e período que o cliente preferir. Se houver manutenção programada, informe o horário previsto. Se está tudo normal e a queixa é lentidão, pergunte quantas pessoas e aparelhos usam; se o plano for pequeno para o uso, ofereça o upgrade e, se o cliente aceitar, chame abrir_chamado tipo upgrade_plano.
3. Financeiro: informe valor, vencimento e situação da fatura e o link do Pix.
4. Mudança de endereço: chame abrir_chamado tipo mudanca_endereco com o novo endereço.
5. Cancelamento, reclamação formal, contestação de cobrança ou qualquer coisa fora do seu alcance: chame encaminhar_atendente com o resumo.

Regras:
- Português do Brasil, mensagens curtas (até 3 frases), tom simpático e direto, sem markdown e sem listas.
- Use apenas os dados dos planos e das ferramentas. Nunca invente valores, prazos ou condições.
- Não peça CPF, RG nem dados de cartão.
- Depois de chamar encaminhar_atendente, apenas avise que o atendente continua no chat e não faça mais perguntas.`;

async function completar(messages) {
  if (!PROVEDOR.key) throw new Error("nenhuma chave de IA no .env (OPENAI_API_KEY ou OPENROUTER_API_KEY)");
  const r = await fetch(PROVEDOR.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROVEDOR.key}`, "content-type": "application/json", "HTTP-Referer": `http://localhost:${PORT}`, "X-Title": "ETECC Assistente IA" },
    body: JSON.stringify({ model: PROVEDOR.modelo, ...PROVEDOR.extra, messages: [{ role: "system", content: SYSTEM }, ...messages], tools, tool_choice: "auto" }),
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error?.message || `${PROVEDOR.nome} HTTP ${r.status}`);
  console.log(`[modelo] ${data.model}`);
  return data.choices[0].message;
}

async function rodarIA(s) {
  for (let i = 0; i < 6; i++) { // ponytail: no máximo 6 rodadas de ferramenta por turno
    const msg = await completar(s.messages);
    s.messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
    const texto = (msg.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim(); // modelos livres ignoram o "sem markdown" às vezes
    if (texto) s.log.push({ de: "ia", texto });
    if (!msg.tool_calls?.length) return;
    for (const tc of msg.tool_calls) {
      let out;
      try { out = runTool(s, tc.function.name, JSON.parse(tc.function.arguments || "{}")); }
      catch (e) { out = { erro: "argumentos inválidos: " + e.message }; }
      console.log(`[${s.id}] ${tc.function.name}`, tc.function.arguments, "->", out);
      s.messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
    }
    if (s.status !== "ia") return; // encaminhado ao atendente: a IA sai da conversa
  }
}

async function chat({ sessionId, perfil = {}, text, since = 0 }) {
  const s = sessoes.get(sessionId) || novaSessao(perfil);
  if (text) {
    s.log.push({ de: "cliente", texto: text });
    if (s.status === "ia") s.messages.push({ role: "user", content: text });
  }
  if (s.status === "ia") {
    try {
      await rodarIA(s);
    } catch (e) {
      console.error(e);
      s.status = "fila"; s.motivo = "IA indisponível"; s.resumo = "Falha técnica na IA. Assumir a conversa pelo histórico.";
      s.log.push({ de: "sistema", tipo: "fila", texto: "Nossa IA está indisponível agora. Um atendente humano vai continuar por aqui mesmo." });
    }
  }
  return estado(s, since);
}

// ---------- HTTP ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".woff2": "font/woff2", ".woff": "font/woff" };
const json = (res, data, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };

const isMain = process.argv[1] === fileURLToPath(import.meta.url); // false quando importado pelo test.mjs
if (isMain) http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    let body = "";
    if (req.method === "POST") { for await (const chunk of req) body += chunk; body = JSON.parse(body || "{}"); }

    if (req.method === "POST" && url.pathname === "/api/chat") return json(res, await chat(body));

    const m = url.pathname.match(/^\/api\/sessoes(?:\/([\w-]+))?(?:\/(atendente|encerrar))?$/);
    if (m) {
      if (!m[1]) return json(res, [...sessoes.values()].map((s) => ({ id: s.id, status: s.status, criado: s.criado, modo: s.perfil.modo, motivo: s.motivo, ultima: s.log.at(-1)?.texto?.slice(0, 80) })));
      const s = sessoes.get(m[1]);
      if (!s) return json(res, { error: "sessão não encontrada" }, 404);
      if (m[2] === "atendente" && body.texto) { s.status = "humano"; s.log.push({ de: "atendente", texto: body.texto }); }
      if (m[2] === "encerrar") { s.status = "encerrado"; s.log.push({ de: "sistema", tipo: "encerrado", texto: "Atendimento encerrado. Obrigado por falar com a ETECC!" }); }
      return json(res, estado(s, Number(url.searchParams.get("since") || 0)));
    }

    if (url.pathname === "/api/registros") { res.writeHead(200, { "content-type": "application/json" }); return res.end(fs.existsSync(REGISTROS) ? fs.readFileSync(REGISTROS) : "[]"); }

    let file = path.join(SITE, decodeURIComponent(url.pathname));
    if (!file.startsWith(SITE)) throw new Error("forbidden");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + ".html")) file += ".html"; // /painel -> painel.html
      else if (path.extname(file)) { res.writeHead(404); return res.end(); }
      else file = path.join(SITE, "index.html"); // rotas do site original (/residencial etc.) caem na home
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    json(res, { error: e.message || String(e) }, 500);
  }
}).listen(PORT, () => console.log(`ETECC Assistente IA em http://localhost:${PORT}  |  painel: http://localhost:${PORT}/painel  |  IA: ${PROVEDOR.nome} ${PROVEDOR.modelo}${PROVEDOR.key ? "" : "  |  AVISO: sem chave de IA no .env"}`));
