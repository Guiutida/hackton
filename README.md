# ETECC Assistente IA — protótipo (hackathon PG Tech)

Tema: como usar tecnologia e IA para revolucionar as vendas da ETECC Telecom em Praia Grande.

Réplica da home da ETECC (assets copiados de eteccnet.com.br) com uma seção nova,
**Vendas e suporte com IA**, entre "Planos" e "Sobre". Tudo acontece no chat do site,
sem mandar o cliente para o WhatsApp:

**Vendas (cliente novo)**
1. Quiz de 4 perguntas gera o plano ideal (regra em `site/planos.js`).
2. A IA confirma o plano, pede CEP/bairro e consulta cobertura (`consultar_cobertura`).
3. Com cobertura, coleta nome, telefone, endereço e data de instalação e fecha o pedido (`finalizar_pedido`, protocolo salvo em `registros.json`).

**Suporte (cliente existente)**
1. A IA identifica o cliente pelo telefone ou contrato (`consultar_cliente`, cadastro mockado).
2. Diagnostica a conexão (bloqueio por fatura, ONU offline, manutenção programada, lentidão), informa fatura e link do Pix, e abre chamados de visita técnica, upgrade de plano ou mudança de endereço (`abrir_chamado`).

**Atendente humano no mesmo chat**
- Sem cobertura, empresa, cancelamento, contestação, reclamação ou pedido de atendente: a IA chama `encaminhar_atendente` com o resumo e sai da conversa.
- A conversa aparece em http://localhost:3000/painel com histórico, motivo e resumo. O atendente responde ali e o cliente vê no mesmo chat do site.
- Se a IA falhar (sem chave, erro de rede), a conversa vai automaticamente para a fila do atendente.

## Rodar

A IA usa a OpenAI se houver `OPENAI_API_KEY`; senão usa a OpenRouter com modelos gratuitos (com suporte a ferramentas). Crie um arquivo `.env` na raiz:

```
OPENAI_API_KEY=sk-proj-...
# OPENAI_MODEL=gpt-5.4-nano            (padrão; gpt-4.1-nano é mais barato ainda e também chama ferramentas; gpt-5.4-mini se quiser mais precisão)
OPENROUTER_API_KEY=sk-or-v1-...
# OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free   (lista: principal + fallbacks)
```

Para forçar a OpenRouter, remova ou comente a linha `OPENAI_API_KEY`. Limite da conta gratuita da OpenRouter: 50 requisições por dia em modelos `:free`; com US$ 10 de crédito sobe para 1000 por dia.

```bash
npm start
```

- Site: http://localhost:3000. A seção "Vendas e suporte com IA" (entre Planos e Sobre) e o botão flutuante "Fale com a ETECC" são a porta de entrada: a primeira escolha ou mensagem abre a tela dedicada.
- Tela dedicada: http://localhost:3000/atendimento. Chat em tela cheia no estilo ChatGPT mobile (logo no topo, campo fixo embaixo, funciona no celular). Boa para QR code e para testes de várias pessoas. Aceita `?opt=vendas`, `?opt=suporte` ou `?q=mensagem`.
- Painel do atendente: http://localhost:3000/painel
- Pedidos e chamados: `registros.json` ou http://localhost:3000/api/registros
- Self-check da lógica: `node test.mjs`

## Deploy (Coolify)

O repositório tem um `Dockerfile` (Node 22, sem dependências npm). No Coolify:

1. Novo recurso → Git repository → este repositório, branch `main`, build pack **Dockerfile**.
2. Porta exposta: `3000`.
3. Variáveis de ambiente (aba Environment Variables):
   - `OPENAI_API_KEY` = sua chave (obrigatória para a IA funcionar)
   - `OPENAI_MODEL` = `gpt-5.4-nano` (opcional)
   - `OPENROUTER_API_KEY` (opcional, só se quiser rodar sem a OpenAI)
4. Deploy. Sem chave de IA o site sobe, mas toda conversa cai direto na fila do atendente humano.

Sessões ficam em memória e `registros.json` no disco do container: some ao reiniciar. Suficiente para a demo.

## Clientes fictícios para a demo de suporte

| Telefone | Contrato | Cenário |
|---|---|---|
| 13 99999-0001 | 48213 | Maria, 600 MEGA, tudo normal. Reclamar de lentidão com muita gente leva a oferta de upgrade. |
| 13 99999-0002 | 51877 | João, bloqueado por fatura vencida. IA explica e passa o Pix. |
| 13 99999-0003 | 60342 | Ana, ONU offline. IA orienta reiniciar e abre visita técnica. |
| 13 99999-0004 | 39120 | Carlos, manutenção programada no bairro Tupi hoje. |

Cobertura: CEPs 117xx e bairros conhecidos de Praia Grande têm fibra; "Quietude", "Samambaia" e "Anhanguera" aparecem como "em expansão"; o resto cai fora da área.

## Arquivos

- `server.js` — servidor estático + API (`/api/chat`, `/api/sessoes`, `/api/registros`). Chama a OpenRouter (formato OpenAI, sem SDK) com 5 ferramentas. Sessões ficam em memória.
- `site/index.html` — home original + seção `#consultor` (fica fora da ilha React e é movida para antes de `#sobre` após a hidratação).
- `site/consultor.js` / `site/consultor.css` — quiz, chat, polling do atendente e estilo.
- `site/painel.html` — painel do atendente humano.
- `site/planos.js` — planos, preços e regra de recomendação (usado pelo navegador e pelo servidor).
