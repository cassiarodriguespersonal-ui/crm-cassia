/* ============================================================
   config.js
   Configurações do CRM — Cássia Rodrigues | Personal Trainer
   ------------------------------------------------------------
   Este arquivo define os valores padrão do sistema. Tudo aqui
   pode ser sobrescrito pela tela de Configurações dentro do
   próprio CRM (os valores editados ficam salvos no navegador,
   via localStorage, e têm prioridade sobre os padrões abaixo).
   ============================================================ */

const CONFIG_PADRAO = {
  // URL do seu Apps Script implantado (Google Sheets + Drive).
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbwxfWT6FzUK0wD_FiS9yPA6Fxp_2pg2Fox4vffOfd2wAiajbcjLMvJ5ggG1NxkuCFX8/exec",

  // Seus dados de contato (usados nos botões "Meu WhatsApp" etc.)
  meuWhatsapp: "5591985766547",
  meuEmail: "cassiarodriguespersonal@gmail.com",
  meuNome: "Cássia Rodrigues",

  // Links das páginas que as alunas usam (hospedadas no mesmo repositório do GitHub).
  linkFicha: "https://cassiarodriguespersonal-ui.github.io/crm-cassia/anamnese.html",
  linkGuiaFotos: "https://cassiarodriguespersonal-ui.github.io/crm-cassia/guia-fotos.html",
  linkCheckin: "https://cassiarodriguespersonal-ui.github.io/crm-cassia/checkin.html",
  linkContrato: "https://cassiarodriguespersonal-ui.github.io/crm-cassia/contrato.html",

  // Após quantos dias sem check-in o Dashboard deve alertar.
  diasAlertaCheckin: 7,

  // Após quantos dias sem fotos novas o Dashboard deve alertar.
  diasAlertaFotos: 30,
  diasAlertaReavaliacao: 45,

  // Modelos de mensagem — use {nome} para o nome da aluna.
  modelosWhatsapp: {
    apresentarFicha: "Oi! Antes da nossa primeira sessão, preciso que você preencha sua ficha de avaliação. Leva uns 12 a 15 minutos: ",
    apresentarGuiaFotos: "Oi! Para completar sua avaliação, preencha o guia rápido de fotos de progresso: ",
    apresentarCheckin: "Oi! Está na hora do seu check-in semanal. Leva menos de um minuto: ",
    boasVindas: "Oi, {nome}! Que bom ter você como aluna. Estou à disposição para qualquer dúvida nessa fase inicial. Vamos juntas! 💪",
    lembreteSemanal: "Oi, {nome}! Passando para saber como foi sua semana de treino. Pode me contar por aqui ou preencher o check-in: ",
    solicitarCheckin: "Oi, {nome}! Está na hora do seu check-in semanal. Leva menos de um minuto: ",
    solicitarFotos: "Oi, {nome}! Vamos atualizar suas fotos de avaliação? Aqui está o guia rapidinho de como tirar: ",
    solicitarReavaliacao: "Oi, {nome}! Já faz um tempinho desde sua última avaliação, e acho que está na hora de revisarmos juntas como você está e ajustar o que for preciso no seu treino. Podemos marcar?",
    lembretePagamento: "Oi, {nome}! Passando para lembrar da renovação da consultoria. Qualquer dúvida sobre valores ou formas de pagamento, me chama por aqui.",
    motivacao: "Oi, {nome}! Só passando para te lembrar que cada treino conta, mesmo nos dias difíceis. Conte comigo no que precisar! 💪"
  },

  modelosEmail: {
    boasVindas: { assunto: "Bem-vinda(o)!", corpo: "Olá, {nome},\n\nQue bom ter você como aluna(o). Estou à disposição para qualquer dúvida nessa fase inicial.\n\nAbraço,\nCássia" },
    lembreteSemanal: { assunto: "Como foi sua semana?", corpo: "Olá, {nome},\n\nPassando para saber como foi sua semana de treino.\n\nAbraço,\nCássia" },
    solicitarFotos: { assunto: "Hora de atualizar suas fotos", corpo: "Olá, {nome},\n\nVamos atualizar suas fotos de avaliação? Segue o guia de como tirar certinho.\n\nAbraço,\nCássia" },
    renovacao: { assunto: "Renovação da consultoria", corpo: "Olá, {nome},\n\nPassando para lembrar da renovação da sua consultoria.\n\nAbraço,\nCássia" }
  }
};

/* Carrega a configuração ativa: padrão + qualquer edição salva localmente. */
function carregarConfig() {
  try {
    const salvo = localStorage.getItem("crm_config");
    if (!salvo) return structuredClone(CONFIG_PADRAO);
    const editado = JSON.parse(salvo);
    const mesclado = Object.assign(structuredClone(CONFIG_PADRAO), editado);
    // Mesclagem profunda dos modelos de mensagem: garante que modelos novos
    // adicionados em atualizações futuras sempre apareçam, mesmo que a
    // configuração já salva no navegador seja de uma versão mais antiga.
    mesclado.modelosWhatsapp = Object.assign(structuredClone(CONFIG_PADRAO.modelosWhatsapp), editado.modelosWhatsapp || {});
    mesclado.modelosEmail = Object.assign(structuredClone(CONFIG_PADRAO.modelosEmail), editado.modelosEmail || {});
    return mesclado;
  } catch (e) {
    console.warn("Não foi possível ler configurações salvas, usando padrão.", e);
    return structuredClone(CONFIG_PADRAO);
  }
}

/* Salva a configuração editada (mescla com o que já existia). */
function salvarConfig(novaConfig) {
  localStorage.setItem("crm_config", JSON.stringify(novaConfig));
}
