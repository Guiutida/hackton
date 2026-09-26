// Self-check da lógica não trivial: `node test.mjs`
import assert from "node:assert/strict";
import { recomendar, PLANOS } from "./site/planos.js";
import { consultarCobertura, consultarCliente } from "./server.js";

assert.equal(consultarCliente({ telefone: "(13) 99999-0002" }).nome, "João Lima");
assert.equal(consultarCliente({ telefone: "+55 13 99999-0003" }).contrato, "60342");
assert.equal(consultarCliente({ contrato: "48213" }).nome, "Maria Souza");
assert.equal(consultarCliente({ telefone: "13900000000" }).encontrado, false);
assert.equal(consultarCliente({}).encontrado, false);

assert.equal(recomendar({ pessoas: "1-2", uso: "basico", assistencia: "nao" }), "600");
assert.equal(recomendar({ pessoas: "3-4", uso: "homeoffice", assistencia: "nao" }), "800");
assert.equal(recomendar({ pessoas: "1-2", uso: "streaming", assistencia: "nao" }), "800");
assert.equal(recomendar({ pessoas: "5+", uso: "basico", assistencia: "nao" }), "premium");
assert.equal(recomendar({ pessoas: "1-2", uso: "basico", assistencia: "sim" }), "premium");
assert.equal(recomendar({ pessoas: "1-2", uso: "games", assistencia: "sim" }), "gamer");
for (const id of ["600", "800", "premium", "gamer"]) assert.ok(PLANOS[id]);

assert.equal(consultarCobertura({ cep: "11700-100" }).coberto, true);
assert.equal(consultarCobertura({ bairro: "Boqueirão" }).coberto, true);
assert.equal(consultarCobertura({ bairro: "Vila Caiçara", cep: "" }).coberto, true);
assert.equal(consultarCobertura({ bairro: "Quietude" }).status, "em_expansao");
assert.equal(consultarCobertura({ cep: "11740-000" }).coberto, true); // Itanhaém
assert.equal(consultarCobertura({ cep: "01310-100", bairro: "Bela Vista" }).status, "fora_da_area");
assert.equal(consultarCobertura({}).coberto, false);

console.log("ok");
