// Fonte única dos planos: usada pelo quiz no navegador e pelo servidor (prompt da IA).
export const PLANOS = {
  "600": {
    nome: "600 MEGA", velocidade: 600, preco: 109.9,
    beneficios: ["Internet Livre", "Wi-Fi Premium", "Suporte express", "Instalação grátis", "Sem fidelidade", "Atendimento 24h", "Equipamento em comodato"],
  },
  "800": {
    nome: "800 MEGA", velocidade: 800, preco: 129.9,
    beneficios: ["Internet Livre", "Wi-Fi Premium", "Suporte express", "Instalação grátis", "Sem fidelidade", "Atendimento 24h", "Equipamento em comodato"],
  },
  premium: {
    nome: "ETECC PREMIUM 1000 MEGA", velocidade: 1000, preco: 149.9, destaque: "+ Vendido",
    beneficios: ["Assistência Familiar: Telemedicina Porto + Manutenção Residencial Porto", "Wi-Fi Premium", "Suporte express", "Atendimento 24h", "Equipamento em comodato"],
  },
  gamer: {
    nome: "ETECC GAMER 1000 MEGA", velocidade: 1000, preco: 169.9,
    beneficios: ["Internet Livre", "Wi-Fi de última geração", "2 pontos cabeados", "ExitLag incluso", "Suporte express", "Instalação grátis", "Sem fidelidade", "Equipamento em comodato"],
  },
};

export const EMPRESA = [
  "ESSÊNCIA: link de internet 1GB + Wi-Fi gerenciado",
  "INTELIGENTE: link 1GB + Wi-Fi gerenciado + Hotspot + suporte empresarial + NOC Premium + firewall e segurança de rede + mini nobreak",
  "PRO: tudo do Inteligente + redundância 5GB ou fibra + suporte exclusivo",
];

// Regra do plano ideal a partir do quiz.
export function recomendar({ pessoas, uso, assistencia }) {
  if (uso === "games") return "gamer";
  if (assistencia === "sim" || pessoas === "5+") return "premium";
  if (pessoas === "3-4" || uso === "streaming" || uso === "homeoffice") return "800";
  return "600";
}
