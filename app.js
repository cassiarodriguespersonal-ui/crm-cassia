/* ============================================================
   app.js — Lógica principal do CRM
   ============================================================ */

let CONFIG = carregarConfig();
let ALUNAS = [];           // dados crus vindos da planilha
let LISTA_FILTRADA = [];   // usada para mapear índices ao editar/excluir

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', function () {
  preencherFormularioConfig();
  ligarNavegacao();
  ligarTopbar();
  ligarModalAluna();
  ligarModalNovaAluna();
  mostrarSecao('dashboard');
  carregarDados();

  // Atualização automática silenciosa a cada 5 minutos.
  // Usa forcarAtualizacao=true para ignorar o cache do Apps Script e
  // garantir que os dados refletem o estado real da planilha.
  setInterval(function () {
    carregarDados(true);
  }, 5 * 60 * 1000);
});

function ligarNavegacao() {
  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function () {
      mostrarSecao(item.getAttribute('data-section'));
      document.getElementById('sidebar').classList.remove('open');
    });
  });
  document.getElementById('btnHamburger').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.querySelectorAll('.bottom-nav-item[data-section]').forEach(function (item) {
    item.addEventListener('click', function () {
      mostrarSecao(item.getAttribute('data-section'));
    });
  });

  function fecharMaisSheet() {
    document.getElementById('maisSheet').classList.remove('show');
    document.getElementById('maisSheetFundo').classList.remove('show');
  }
  document.getElementById('bottomNavMais').addEventListener('click', function () {
    document.getElementById('maisSheet').classList.toggle('show');
    document.getElementById('maisSheetFundo').classList.toggle('show');
  });
  document.getElementById('maisSheetFundo').addEventListener('click', fecharMaisSheet);
  document.querySelectorAll('.mais-sheet-item[data-section]').forEach(function (item) {
    item.addEventListener('click', function () {
      mostrarSecao(item.getAttribute('data-section'));
      fecharMaisSheet();
    });
  });
}

const TITULOS_SECAO = {
  dashboard: ['Dashboard', 'Visão geral da consultoria'],
  alunas: ['Gestão de alunos', 'Todas as alunas, fichas e cadastros manuais'],
  checkins: ['Check-ins', 'Envio e histórico de check-ins'],
  financeiro: ['Financeiro', 'Pagamentos, planos e renovações'],
  ferramentas: ['Ferramentas', 'Atalhos, modelos e envio de mensagens'],
  automacoes: ['Automações', 'Regras automáticas e gatilhos prontos para enviar'],
  treinos: ['Treinos', 'Em construção'],
  materiais: ['Materiais', 'Em construção'],
  config: ['Configurações', 'Ajustes gerais do sistema']
};

function mostrarSecao(nome) {
  document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById('section-' + nome).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.classList.toggle('active', item.getAttribute('data-section') === nome);
  });
  document.querySelectorAll('.bottom-nav-item[data-section]').forEach(function (item) {
    item.classList.toggle('active', item.getAttribute('data-section') === nome);
  });
  const titulo = TITULOS_SECAO[nome] || [nome, ''];
  document.getElementById('topbarTitulo').textContent = titulo[0];
  document.getElementById('topbarSub').textContent = titulo[1];

  if (nome === 'dashboard') renderDashboard();
  if (nome === 'alunas') renderAlunas();
  if (nome === 'checkins') { renderCheckins(); renderEnvioCheckin(); }
  if (nome === 'financeiro') renderFinanceiro();
  if (nome === 'ferramentas') {
    try { renderCompartilhar(); } catch (e) { console.error('renderCompartilhar falhou:', e); }
    try { renderModelosUnificados(); } catch (e) { console.error('renderModelosUnificados falhou:', e); }
    try { renderEnvioFerramenta(); } catch (e) { console.error('renderEnvioFerramenta falhou:', e); }
  }
  if (nome === 'automacoes') renderAutomacoes();
}

function ligarTopbar() {
  document.getElementById('btnAtualizar').addEventListener('click', function () { carregarDados(true); });
  document.getElementById('btnLimparAlertas').addEventListener('click', function () {
    localStorage.setItem('crm_alertas_limpos_em', new Date().toDateString());
    renderDashboard();
    mostrarToast('Alertas limpos por hoje.');
  });
}

/* ---------- CARREGAMENTO DE DADOS ---------- */
function carregarDados(forcarAtualizacao) {
  mostrarToast('Atualizando dados...');
  Api.buscarAlunas(forcarAtualizacao).then(function (dados) {
    dados.forEach(function (a) { a['Nome'] = formatarNomeProprio(a['Nome']); });
    ALUNAS = dados;
    const secaoAtiva = document.querySelector('.section.active');
    if (secaoAtiva) mostrarSecao(secaoAtiva.id.replace('section-', ''));
    mostrarToast('Dados atualizados!');
  }).catch(function (err) {
    console.error(err);
    mostrarToast('Não foi possível carregar os dados. Veja Configurações.');
  });
}

/* ---------- UTILITÁRIOS ---------- */
function formatarData(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('pt-BR');
}
function formatarDataHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function diasDesde(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function diasAte(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}
function telefoneParaWhats(tel) {
  let digitos = String(tel || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length <= 11) digitos = '55' + digitos;
  return digitos;
}
function gestaoDe(aluna) {
  return aluna.gestao || { status: 'Ativo', pagamento: 'Pago', plano: '—', valor: '', proximaRenovacao: '', arquivado: 'Não', etiquetas: '' };
}
function etiquetasDe(aluna) {
  const bruto = gestaoDe(aluna).etiquetas || '';
  return bruto.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}
function alunasVisiveis() {
  return ALUNAS.filter(function (a) { return gestaoDe(a).arquivado !== 'Sim'; });
}
function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2400);
}
function primeiroNome(nomeCompleto) {
  return String(nomeCompleto || '').trim().split(' ')[0];
}

/* Deixa o nome com a primeira letra de cada palavra maiúscula, do jeito
   certo em português (preposições como "da", "de", "dos" continuam
   minúsculas, exceto se forem a primeira palavra). Resolve nomes digitados
   TUDO EM CAIXA ALTA ou tudo minúsculo, sem precisar corrigir manualmente
   na planilha. */
function formatarNomeProprio(nome) {
  if (!nome) return '';
  const particulas = ['da', 'de', 'do', 'das', 'dos', 'e'];
  return String(nome).trim().toLowerCase().split(/\s+/).map(function (palavra, indice) {
    if (indice > 0 && particulas.indexOf(palavra) !== -1) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ');
}

/* Monta o link de check-in já identificando a aluna — o checkin.html
   exige esse parâmetro pra saber de quem é. Usar sempre essa função em
   vez de CONFIG.linkCheckin direto, ou o link chega quebrado pra ela. */
function linkCheckinPara(nome) {
  const separador = CONFIG.linkCheckin.indexOf('?') === -1 ? '?' : '&';
  return CONFIG.linkCheckin + separador + 'nome=' + encodeURIComponent(nome || '');
}

/* O Google Sheets, às vezes, entende sozinho que um texto tipo "14:22"
   é um horário e converte por baixo dos panos para uma data interna
   (com aquele ano 1899 característico). Isso devolve sempre "HH:mm"
   limpo, não importa em qual dos dois formatos o valor chegou. */
function horaLimpa(valor) {
  if (!valor) return '';
  const texto = String(valor);
  if (/^\d{1,2}:\d{2}$/.test(texto)) return texto;
  const d = new Date(texto);
  if (!isNaN(d.getTime())) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  return texto;
}

function blocoContrato(a) {
  const whats = telefoneParaWhats(a['Telefone']);
  const nome = a['Nome'] || '';
  const contrato = a.contrato;

  let html = '<h3 style="font-size:.95rem; margin-bottom:.7rem;">Contrato</h3>';

  if (contrato && contrato['Status'] === 'Aceito') {
    const dataAceite = contrato['Data Aceite'] ? new Date(contrato['Data Aceite']).toLocaleDateString('pt-BR') : '—';
    const hora = horaLimpa(contrato['Hora Aceite']);
    html += '<div style="background:#DEEAE1; color:#3E6650; border-radius:8px; padding:.7rem .9rem; font-size:.85rem; margin-bottom:1.4rem;">' +
      '✓ Aceito em ' + dataAceite + (hora ? ' às ' + hora : '') +
      '</div>';
  } else {
    html += '<div style="background:#F4E6D7; color:#A8591C; border-radius:8px; padding:.7rem .9rem; font-size:.85rem; margin-bottom:.7rem;">⏳ ' +
      (contrato ? 'Gerado, aguardando aceite.' : 'Ainda não enviado.') + '</div>';
    if (whats && CONFIG.linkContrato) {
      const separadorContrato = CONFIG.linkContrato.indexOf('?') === -1 ? '?' : '&';
      const linkContratoAluna = CONFIG.linkContrato + separadorContrato + 'nome=' + encodeURIComponent(nome);
      const textoContrato = 'Oi, ' + primeiroNome(nome) + '! Antes de começarmos, preciso que você leia e aceite o contrato: ' + linkContratoAluna;
      html += '<a class="btn btn-sm" target="_blank" href="https://wa.me/' + whats + '?text=' + encodeURIComponent(textoContrato) + '">Enviar contrato no WhatsApp</a>';
    }
    html += '<div style="margin-bottom:1.4rem;"></div>';
  }

  return html;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
/* ============================================================
   SCORE DE RISCO — calcula sinais e nível para uma aluna.
   Usado pelo Dashboard ("quem precisa de carinho"), pela lista
   de alunas (selo 🟢🟡🔴) e pela Central de Tarefas.
   ============================================================ */
function calcularRisco(a) {
  const sinais = [];
  let urgente = false;

  const diasCheckin = a.ultimoCheckin ? diasDesde(a.ultimoCheckin['Data/Hora']) : null;
  if (diasCheckin === null || diasCheckin >= CONFIG.diasAlertaCheckin) {
    sinais.push({ texto: '💬 ' + (diasCheckin === null ? 'Nunca fez check-in' : 'Sem contato há ' + diasCheckin + 'd'), risco: diasCheckin === null || diasCheckin >= CONFIG.diasAlertaCheckin * 2 });
  }
  const humorRecente = a.ultimoCheckin ? a.ultimoCheckin['Humor'] : null;
  if ((humorRecente === 'Estressada' || humorRecente === 'Desanimada') && diasCheckin !== null && diasCheckin <= CONFIG.diasAlertaCheckin) {
    sinais.push({ texto: (humorRecente === 'Estressada' ? '😣 Estressada' : '😔 Desanimada') + ' no último check-in', risco: true });
    urgente = true;
  }
  const ultimaFoto = a.fotos && a.fotos.length ? a.fotos[a.fotos.length - 1] : null;
  const diasFoto = ultimaFoto ? diasDesde(ultimaFoto['Data/Hora']) : null;
  if (diasFoto === null || diasFoto >= CONFIG.diasAlertaFotos) {
    sinais.push({ texto: '📸 Fotos atrasadas', risco: false });
  }
  const g = gestaoDe(a);
  const diasRen = diasAte(g.proximaRenovacao);
  if (g.pagamento === 'Devendo') {
    sinais.push({ texto: '💳 Devendo' + (g.valor ? ' R$' + g.valor : ''), risco: true });
    urgente = true;
  } else if (diasRen !== null && diasRen <= 7) {
    sinais.push({ texto: '📅 Renova em ' + (diasRen < 0 ? 'atraso' : diasRen + 'd'), risco: diasRen < 0 });
    if (diasRen < 0) urgente = true;
  }
  if (parseInt(a['PAR-Q (positivos)']) > 0) {
    sinais.push({ texto: '🩺 Sinal no PAR-Q', risco: true });
    urgente = true;
  }
  if (diasCheckin !== null && diasCheckin >= CONFIG.diasAlertaCheckin * 2) urgente = true;

  const ultimaEvolucao = a.evolucao && a.evolucao.length ? a.evolucao[a.evolucao.length - 1] : null;
  const diasReavaliacao = ultimaEvolucao ? diasDesde(ultimaEvolucao['Data/Hora']) : (a['Data/Hora'] ? diasDesde(a['Data/Hora']) : null);
  const limiteReavaliacao = CONFIG.diasAlertaReavaliacao || 45;
  if (diasReavaliacao !== null && diasReavaliacao >= limiteReavaliacao) {
    sinais.push({ texto: '📏 Reavaliação física atrasada (' + diasReavaliacao + 'd)', risco: diasReavaliacao >= limiteReavaliacao * 1.5 });
  }

  // Sinal de engajamento: tempo desde a última interação (contato manual registrado)
  const ultimaInteracao = a.ultimaInteracao ? diasDesde(a.ultimaInteracao['Data/Hora']) : null;
  if (ultimaInteracao !== null && ultimaInteracao >= 14) {
    sinais.push({ texto: '📞 Sem contato há ' + ultimaInteracao + 'd', risco: ultimaInteracao >= 30 });
  }

  // Pontuação por gravidade: cada sinal "de risco" pesa o dobro de um sinal leve.
  // É essa pontuação que decide o nível, em vez de só contar quantos sinais existem.
  const pontuacao = sinais.reduce(function (soma, s) { return soma + (s.risco ? 2 : 1); }, 0);

  let nivel = 'excelente';
  const limiares = CONFIG.limiaresRisco || { critico: 5, emRisco: 3, atencao: 1 };
  if (urgente || pontuacao >= limiares.critico) nivel = 'critico';
  else if (pontuacao >= limiares.emRisco) nivel = 'em_risco';
  else if (pontuacao >= limiares.atencao) nivel = 'atencao';

  return { sinais: sinais, urgente: urgente, nivel: nivel, pontuacao: pontuacao, diasCheckin: diasCheckin === null ? 9999 : diasCheckin };
}

/* ============================================================
   ONBOARDING — calculado a partir dos dados que já existem
   (anamnese, contrato, check-ins, fotos, evolução), sem precisar
   de nenhuma gravação nova. Os "primeiros passos" de toda aluna.
   ============================================================ */
function calcularOnboarding(a) {
  const passos = [
    { label: 'Ficha de anamnese preenchida', feito: a.origem !== 'manual' && !!a['Data/Hora'] },
    { label: 'Contrato aceito', feito: !!(a.contrato && a.contrato['Status'] === 'Aceito') },
    { label: 'Primeiro check-in', feito: !!(a.checkins && a.checkins.length) },
    { label: 'Primeiras fotos enviadas', feito: !!(a.fotos && a.fotos.length) },
    { label: 'Primeira avaliação física registrada', feito: !!(a.evolucao && a.evolucao.length) }
  ];
  const completos = passos.filter(function (p) { return p.feito; }).length;
  return {
    passos: passos,
    completos: completos,
    total: passos.length,
    percentual: Math.round((completos / passos.length) * 100),
    completo: completos === passos.length
  };
}

function renderDashboard() {
  const visiveis = alunasVisiveis();
  const total = visiveis.length;
  const ativas = visiveis.filter(function (a) { return gestaoDe(a).status !== 'Inativo'; }).length;
  const inativas = total - ativas;
  const checkinsPendentes = visiveis.filter(function (a) {
    const dias = a.ultimoCheckin ? diasDesde(a.ultimoCheckin['Data/Hora']) : null;
    return dias === null || dias >= CONFIG.diasAlertaCheckin;
  }).length;
  const pagamentosPendentes = visiveis.filter(function (a) { return gestaoDe(a).pagamento === 'Devendo'; }).length;
  const fotosPendentes = visiveis.filter(function (a) {
    if (!a.fotos || !a.fotos.length) return true;
    const ultima = a.fotos[a.fotos.length - 1];
    const dias = diasDesde(ultima['Data/Hora']);
    return dias === null || dias >= CONFIG.diasAlertaFotos;
  }).length;
  const renovacoesProximas = visiveis.filter(function (a) {
    const dias = diasAte(gestaoDe(a).proximaRenovacao);
    return dias !== null && dias >= 0 && dias <= 7;
  }).length;

  // ---- Quem precisa de carinho (calculado cedo para alimentar os cartões também) ----
  const candidatas = [];
  visiveis.forEach(function (a) {
    const r = calcularRisco(a);
    if (r.sinais.length) {
      candidatas.push({ nome: a['Nome'], telefone: a['Telefone'], email: a['E-mail'], sinais: r.sinais, urgente: r.urgente, nivel: r.nivel, diasCheckin: r.diasCheckin });
    }
  });
  candidatas.sort(function (x, y) { return (y.urgente - x.urgente) || (y.diasCheckin - x.diasCheckin); });

  // ---- Os seis cartões do Dashboard ----
  const emRisco = candidatas.filter(function (c) { return c.urgente; }).length;
  const ativasComCheckinAtrasado = visiveis.filter(function (a) {
    if (gestaoDe(a).status === 'Inativo') return false;
    const dias = a.ultimoCheckin ? diasDesde(a.ultimoCheckin['Data/Hora']) : null;
    return dias === null || dias >= CONFIG.diasAlertaCheckin;
  }).length;
  const adesao = ativas > 0 ? Math.round(((ativas - ativasComCheckinAtrasado) / ativas) * 100) : null;

  document.getElementById('dashboardStatsNovo').innerHTML = [
    [total, 'Total de alunas', '👥', 'tom-neutro'],
    [ativas, 'Alunas ativas', '✅', 'tom-bom'],
    [emRisco, 'Alunas em risco', '⚠️', emRisco > 0 ? 'tom-risco' : 'tom-bom'],
    [adesao === null ? '—' : adesao + '%', 'Adesão aos check-ins', '📈', (adesao !== null && adesao < 60) ? 'tom-atencao' : 'tom-bom'],
    [checkinsPendentes, 'Check-ins pendentes', '💬', checkinsPendentes > 0 ? 'tom-atencao' : 'tom-bom'],
    [renovacoesProximas, 'Renovações da semana', '📅', renovacoesProximas > 0 ? 'tom-atencao' : 'tom-neutro']
  ].map(function (s) {
    return '<div class="stat-card ' + s[3] + '"><span class="stat-icon">' + s[2] + '</span><div class="num">' + s[0] + '</div><div class="lbl">' + s[1] + '</div></div>';
  }).join('');

  // ---- Saudação ----
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNomeDela = primeiroNome(CONFIG.meuNome) || 'Cássia';
  document.getElementById('textoSaudacao').textContent = saudacao + ', ' + primeiroNomeDela;

  // ---- Aniversariantes próximos (7 dias) ----
  function proximoAniversario(dataNascimentoStr) {
    if (!dataNascimentoStr) return null;
    const nasc = new Date(dataNascimentoStr);
    if (isNaN(nasc.getTime())) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let proximo = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
    if (proximo < hoje) proximo = new Date(hoje.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
    const dias = Math.round((proximo - hoje) / 86400000);
    return { dias: dias, ehHoje: dias === 0 };
  }

  const aniversariantes = [];
  visiveis.forEach(function (a) {
    const prox = proximoAniversario(a['Data de Nascimento']);
    if (prox && prox.dias <= 7) {
      aniversariantes.push({ nome: a['Nome'], telefone: a['Telefone'], email: a['E-mail'], dias: prox.dias, ehHoje: prox.ehHoje });
    }
  });
  aniversariantes.sort(function (x, y) { return x.dias - y.dias; });

  const painelAniv = document.getElementById('painelAniversariantes');
  if (aniversariantes.length) {
    painelAniv.style.display = 'block';
    document.getElementById('dashboardAniversariantes').innerHTML = aniversariantes.map(function (av, indice) {
      const whats = telefoneParaWhats(av.telefone);
      const quando = av.ehHoje ? '🎉 Hoje!' : 'Em ' + av.dias + ' dia' + (av.dias > 1 ? 's' : '');
      return '<div class="care-card' + (av.ehHoje ? ' urgente' : '') + '">' +
        '<div class="info"><div class="nome">' + av.nome + '</div><div class="sinais"><span class="care-chip' + (av.ehHoje ? ' risco' : '') + '">' + quando + '</span></div></div>' +
        '<div class="acao">' +
          (whats ? '<button class="btn btn-sm btn-accent" data-parabens-whats="' + indice + '">💬 WhatsApp</button> ' : '') +
          (av.email ? '<button class="btn btn-sm" data-parabens-email="' + indice + '">✉️ E-mail</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    document.querySelectorAll('[data-parabens-whats]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const av = aniversariantes[parseInt(btn.getAttribute('data-parabens-whats'), 10)];
        const whats = telefoneParaWhats(av.telefone);
        const texto = 'Parabéns, ' + primeiroNome(av.nome) + '! 🎉🎂 Desejo um ano incrível, cheio de saúde e conquistas. Conte comigo!';
        window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
      });
    });
    document.querySelectorAll('[data-parabens-email]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const av = aniversariantes[parseInt(btn.getAttribute('data-parabens-email'), 10)];
        const corpo = 'Parabéns, ' + primeiroNome(av.nome) + '! 🎉🎂\n\nHoje é o seu dia, e eu não podia deixar de passar para desejar um ano novo de vida cheio de saúde, energia e conquistas — dentro e fora dos treinos.\n\nConte comigo sempre,\n' + (CONFIG.meuNome || '');
        window.location.href = 'mailto:' + av.email + '?subject=' + encodeURIComponent('🎉 Feliz aniversário, ' + primeiroNome(av.nome) + '!') + '&body=' + encodeURIComponent(corpo);
      });
    });
  } else {
    painelAniv.style.display = 'none';
  }

  // ---- Onboarding em andamento (alunas recentes ainda completando os primeiros passos) ----
  const emOnboarding = [];
  visiveis.forEach(function (a) {
    if (a.origem === 'manual' || !a['Data/Hora']) return;
    const dias = diasDesde(a['Data/Hora']);
    if (dias === null || dias > (CONFIG.diasOnboarding || 30)) return;
    const ob = calcularOnboarding(a);
    if (!ob.completo) emOnboarding.push({ nome: a['Nome'], telefone: a['Telefone'], email: a['E-mail'], ob: ob });
  });
  emOnboarding.sort(function (x, y) { return x.ob.percentual - y.ob.percentual; });

  const painelOb = document.getElementById('painelOnboarding');
  if (emOnboarding.length) {
    painelOb.style.display = 'block';
    document.getElementById('dashboardOnboarding').innerHTML = emOnboarding.map(function (o, indice) {
      const whats = telefoneParaWhats(o.telefone);
      return '<div class="care-card">' +
        '<div class="info"><div class="nome">' + o.nome + '</div><div class="sinais"><span class="care-chip">' + o.ob.percentual + '% completo · ' + o.ob.completos + '/' + o.ob.total + '</span></div></div>' +
        '<div class="acao">' +
          (whats ? '<button class="btn btn-sm btn-accent" data-onboarding-whats="' + indice + '">💬 WhatsApp</button> ' : '') +
          (o.email ? '<button class="btn btn-sm" data-onboarding-email="' + indice + '">✉️ E-mail</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    document.querySelectorAll('[data-onboarding-whats]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const o = emOnboarding[parseInt(btn.getAttribute('data-onboarding-whats'), 10)];
        const whats = telefoneParaWhats(o.telefone);
        const texto = 'Oi, ' + primeiroNome(o.nome) + '! Vi que ainda faltam alguns passos pra completar seu cadastro com a gente. Posso te ajudar com isso? 💪';
        window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
      });
    });
    document.querySelectorAll('[data-onboarding-email]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const o = emOnboarding[parseInt(btn.getAttribute('data-onboarding-email'), 10)];
        const corpo = 'Oi, ' + primeiroNome(o.nome) + '!\n\nVi que ainda faltam alguns passos pra completar seu cadastro com a gente. Posso te ajudar com isso?\n\nQualquer dúvida, é só chamar.';
        window.location.href = 'mailto:' + o.email + '?subject=' + encodeURIComponent('Vamos completar seu cadastro?') + '&body=' + encodeURIComponent(corpo);
      });
    });
  } else {
    painelOb.style.display = 'none';
  }

  // ---- Cartão "Seus alunos" ----
  document.getElementById('pillsResumoAlunos').innerHTML =
    '<span class="pill ativos">Ativos: ' + ativas + '</span>' +
    '<span class="pill inativos">Inativos: ' + inativas + '</span>';
  document.getElementById('cardResumoAlunos').onclick = function () { mostrarSecao('alunas'); };

  // ---- Quem precisa de carinho (renderização do painel, dados já calculados acima) ----
  const elCuidado = document.getElementById('dashboardCuidado');
  const hoje = new Date().toDateString();
  const limpoEm = localStorage.getItem('crm_alertas_limpos_em');

  if (limpoEm === hoje) {
    elCuidado.innerHTML = '<div class="care-empty">Você já viu todo mundo hoje. As pendências voltam a aparecer amanhã, se ainda valerem. ✅</div>';
  } else if (candidatas.length) {
    elCuidado.innerHTML = candidatas.slice(0, 12).map(function (c, indice) {
      const whats = telefoneParaWhats(c.telefone);
      return '<div class="care-card nivel-' + c.nivel + '">' +
        '<div class="info">' +
          '<div class="nome">' + c.nome + '</div>' +
          '<div class="sinais">' + c.sinais.map(function (s) { return '<span class="care-chip' + (s.risco ? ' risco' : '') + '">' + s.texto + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="acao">' +
          (whats ? '<button class="btn btn-sm btn-accent" data-cuidado-whats="' + indice + '">💬 WhatsApp</button> ' : '') +
          (c.email ? '<button class="btn btn-sm" data-cuidado-email="' + indice + '">✉️ E-mail</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    document.querySelectorAll('[data-cuidado-whats]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const c = candidatas[parseInt(btn.getAttribute('data-cuidado-whats'), 10)];
        const whats = telefoneParaWhats(c.telefone);
        const texto = (CONFIG.modelosWhatsapp.motivacao || 'Oi, {nome}! Tudo bem? Senti sua falta por aqui. 💪').replace(/\{nome\}/g, primeiroNome(c.nome));
        window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
      });
    });
    document.querySelectorAll('[data-cuidado-email]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const c = candidatas[parseInt(btn.getAttribute('data-cuidado-email'), 10)];
        const modelo = CONFIG.modelosEmail && CONFIG.modelosEmail.motivacao;
        const assunto = modelo ? modelo.assunto : 'Tudo bem por aí?';
        const corpo = (modelo ? modelo.corpo : 'Oi, {nome}! Tudo bem? Senti sua falta por aqui. Conte comigo pra retomar quando puder. 💪').replace(/\{nome\}/g, primeiroNome(c.nome));
        window.location.href = 'mailto:' + c.email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
      });
    });
  } else {
    elCuidado.innerHTML = '<div class="care-empty">Nenhuma pendência agora. Tudo em dia! ✅</div>';
  }

  // Últimas atividades (fichas + check-ins + fotos + evolução + contrato)
  const atividades = [];
  ALUNAS.forEach(function (a) {
    if (a['Data/Hora'] && a.origem !== 'manual') {
      atividades.push({ quando: a['Data/Hora'], texto: a['Nome'] + ' enviou a ficha de anamnese' });
    }
    (a.checkins || []).forEach(function (c) {
      atividades.push({ quando: c['Data/Hora'], texto: a['Nome'] + ' fez um check-in' });
    });
    (a.fotos || []).forEach(function (f) {
      atividades.push({ quando: f['Data/Hora'], texto: a['Nome'] + ' enviou novas fotos' });
    });
    (a.evolucao || []).forEach(function (m) {
      atividades.push({ quando: m['Data/Hora'], texto: a['Nome'] + ' atualizou medidas de evolução física' });
    });
    if (a.contrato && a.contrato['Status'] === 'Aceito') {
      atividades.push({ quando: a.contrato['Data Aceite'], texto: a['Nome'] + ' aceitou o contrato digital' });
    }
  });
  atividades.sort(function (x, y) { return new Date(y.quando) - new Date(x.quando); });
  const elAtiv = document.getElementById('dashboardAtividades');
  elAtiv.innerHTML = atividades.length
    ? atividades.slice(0, 10).map(function (a) {
        return '<div class="activity-item"><span>' + a.texto + '</span><span class="quando">' + formatarDataHora(a.quando) + '</span></div>';
      }).join('')
    : '<div class="alert-empty">Nenhuma atividade registrada ainda.</div>';

  renderTarefas(visiveis);
}

/* ============================================================
   CENTRAL DE TAREFAS — gera pendências reais a partir dos
   mesmos critérios do Score de Risco, com checklist marcável.
   "Concluída" vale só para o dia de hoje: se a pendência
   continuar existindo amanhã, ela volta a aparecer sozinha.
   ============================================================ */
function gerarTarefas(visiveis) {
  const tarefas = [];
  visiveis.forEach(function (a) {
    const g = gestaoDe(a);
    const nome = a['Nome'];

    if (g.pagamento === 'Devendo') {
      tarefas.push({ chave: 'pagamento_' + nome, icone: '💳', texto: 'Cobrar pagamento de ' + nome, aluna: a });
    }
    const diasCheckin = a.ultimoCheckin ? diasDesde(a.ultimoCheckin['Data/Hora']) : null;
    if (diasCheckin === null || diasCheckin >= CONFIG.diasAlertaCheckin) {
      tarefas.push({ chave: 'checkin_' + nome, icone: '💬', texto: 'Solicitar check-in de ' + nome, aluna: a });
    }
    const ultimaFoto = a.fotos && a.fotos.length ? a.fotos[a.fotos.length - 1] : null;
    const diasFoto = ultimaFoto ? diasDesde(ultimaFoto['Data/Hora']) : null;
    if (diasFoto === null || diasFoto >= CONFIG.diasAlertaFotos) {
      tarefas.push({ chave: 'fotos_' + nome, icone: '📸', texto: 'Pedir fotos atualizadas de ' + nome, aluna: a });
    }
    const diasRen = diasAte(g.proximaRenovacao);
    if (diasRen !== null && diasRen <= 7) {
      tarefas.push({ chave: 'renovacao_' + nome, icone: '📅', texto: 'Renovar plano de ' + nome + (diasRen < 0 ? ' (atrasado)' : ''), aluna: a });
    }
    if (!a.contrato || a.contrato['Status'] !== 'Aceito') {
      tarefas.push({ chave: 'contrato_' + nome, icone: '📄', texto: 'Pedir aceite do contrato de ' + nome, aluna: a });
    }
    const ultimaEvolucao = a.evolucao && a.evolucao.length ? a.evolucao[a.evolucao.length - 1] : null;
    const diasReavaliacao = ultimaEvolucao ? diasDesde(ultimaEvolucao['Data/Hora']) : (a['Data/Hora'] ? diasDesde(a['Data/Hora']) : null);
    if (diasReavaliacao !== null && diasReavaliacao >= (CONFIG.diasAlertaReavaliacao || 45)) {
      tarefas.push({ chave: 'reavaliacao_' + nome, icone: '📏', texto: 'Agendar reavaliação física de ' + nome, aluna: a });
    }
  });
  return tarefas;
}

function chaveTarefasHoje() {
  return 'crm_tarefas_concluidas_' + new Date().toDateString();
}
function carregarTarefasConcluidas() {
  try { return JSON.parse(localStorage.getItem(chaveTarefasHoje()) || '[]'); } catch (e) { return []; }
}
function salvarTarefaConcluida(chave) {
  const lista = carregarTarefasConcluidas();
  if (lista.indexOf(chave) === -1) lista.push(chave);
  localStorage.setItem(chaveTarefasHoje(), JSON.stringify(lista));
}
function desfazerTarefaConcluida(chave) {
  const lista = carregarTarefasConcluidas().filter(function (c) { return c !== chave; });
  localStorage.setItem(chaveTarefasHoje(), JSON.stringify(lista));
}

function renderTarefas(visiveis) {
  const el = document.getElementById('dashboardTarefas');
  if (!el) return;

  const tarefas = gerarTarefas(visiveis);
  if (!tarefas.length) {
    el.innerHTML = '<div class="care-empty">Nenhuma tarefa pendente. Tudo em dia! ✅</div>';
    return;
  }

  const concluidas = carregarTarefasConcluidas();
  const pendentes = tarefas.filter(function (t) { return concluidas.indexOf(t.chave) === -1; });
  const feitas = tarefas.filter(function (t) { return concluidas.indexOf(t.chave) !== -1; });

  function linha(t, feita) {
    const whats = telefoneParaWhats(t.aluna['Telefone']);
    return '<div class="care-card" style="' + (feita ? 'opacity:.5;' : '') + '">' +
      '<div class="info">' +
        '<label style="display:flex; align-items:center; gap:.6rem; cursor:pointer;">' +
          '<input type="checkbox" data-tarefa="' + t.chave + '"' + (feita ? ' checked' : '') + '>' +
          '<span class="icone-tarefa">' + t.icone + '</span>' +
          '<span style="' + (feita ? 'text-decoration:line-through;' : '') + '">' + t.texto + '</span>' +
        '</label>' +
      '</div>' +
      (whats && !feita ? '<div class="acao"><a class="btn btn-sm btn-accent" href="https://wa.me/' + whats + '" target="_blank">💬 Falar</a></div>' : '') +
    '</div>';
  }

  el.innerHTML = pendentes.map(function (t) { return linha(t, false); }).join('') +
    feitas.map(function (t) { return linha(t, true); }).join('');

  el.querySelectorAll('[data-tarefa]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const chave = cb.getAttribute('data-tarefa');
      if (cb.checked) salvarTarefaConcluida(chave); else desfazerTarefaConcluida(chave);
      renderTarefas(visiveis);
    });
  });
}


/* ============================================================
   COMPARTILHAR COM NOVAS ALUNAS (atalho no Dashboard)
   ============================================================ */
function renderCompartilhar() {
  // Textos de mensagem
  document.getElementById('textoApresentarFicha').value = CONFIG.modelosWhatsapp.apresentarFicha || '';
  document.getElementById('textoApresentarFotos').value = CONFIG.modelosWhatsapp.apresentarGuiaFotos || '';
  document.getElementById('textoApresentarContrato').value = CONFIG.modelosWhatsapp.apresentarContrato || 'Oi! Antes de começarmos, preciso que você leia e aceite o contrato: ';

  // Links rápidos
  var linksRapidos = [
    { spanId: 'linkRapidoFicha',    valor: CONFIG.linkFicha },
    { spanId: 'linkRapidoFotos',    valor: CONFIG.linkGuiaFotos },
    { spanId: 'linkRapidoCheckin',  valor: CONFIG.linkCheckin },
    { spanId: 'linkRapidoContrato', valor: CONFIG.linkContrato }
  ];
  linksRapidos.forEach(function (l) {
    var el = document.getElementById(l.spanId);
    if (el) el.textContent = l.valor || '—';
  });
}

const ROTULOS_MODELO_WHATS = { boasVindas: 'Boas-vindas', lembreteSemanal: 'Lembrete semanal', solicitarCheckin: 'Pedir check-in', solicitarFotos: 'Pedir fotos', lembretePagamento: 'Lembrete de pagamento', motivacao: 'Motivação' };
const ROTULOS_MODELO_EMAIL = { boasVindas: 'Boas-vindas', lembreteSemanal: 'Lembrete semanal', solicitarFotos: 'Pedir fotos', renovacao: 'Renovação' };

function renderEnvioFerramenta() {
  const listaEl = document.getElementById('ferramentaListaAlunas');
  const visiveis = alunasVisiveis();

  listaEl.innerHTML = visiveis.length ? visiveis.map(function (a, i) {
    return '<label style="display:flex; align-items:center; justify-content:flex-start; gap:.6rem; padding:.4rem 0; border-bottom:1px solid var(--line-soft); font-size:.86rem; font-weight:400; color:var(--ink); margin-bottom:0; cursor:pointer;">' +
      '<input type="checkbox" class="ferramenta-check-aluna" value="' + i + '" style="width:auto; height:auto; flex-shrink:0; margin:0; padding:0;">' +
      '<span>' + a['Nome'] + '</span>' +
    '</label>';
  }).join('') : '<p style="color:var(--ink-soft); font-size:.84rem;">Nenhuma aluna cadastrada.</p>';

  document.getElementById('ferramentaSelecionarTodas').checked = false;
  document.getElementById('ferramentaSelecionarTodas').onchange = function () {
    const marcado = this.checked;
    listaEl.querySelectorAll('.ferramenta-check-aluna').forEach(function (cb) { cb.checked = marcado; });
  };

  function atualizarModelos() {
    const canal = document.getElementById('ferramentaCanal').value;
    const rotulos = canal === 'whatsapp' ? ROTULOS_MODELO_WHATS : ROTULOS_MODELO_EMAIL;
    document.getElementById('ferramentaModelo').innerHTML = Object.keys(rotulos).map(function (k) {
      return '<option value="' + k + '">' + rotulos[k] + '</option>';
    }).join('');
    document.getElementById('ferramentaAvisoCanal').textContent = canal === 'whatsapp'
      ? 'O WhatsApp não permite envio automático: uma conversa abre pronta para cada aluna selecionada, e você só precisa tocar em enviar em cada uma.'
      : 'Por e-mail, o envio é 100% automático: todas as selecionadas recebem na hora, sem precisar abrir nada.';
  }
  atualizarModelos();
  document.getElementById('ferramentaCanal').onchange = atualizarModelos;

  document.getElementById('btnEnviarFerramenta').onclick = function () {
    const indices = Array.from(listaEl.querySelectorAll('.ferramenta-check-aluna:checked')).map(function (cb) { return parseInt(cb.value, 10); });
    if (!indices.length) { mostrarToast('Selecione ao menos uma aluna.'); return; }

    const selecionadas = indices.map(function (i) { return visiveis[i]; });
    const canal = document.getElementById('ferramentaCanal').value;
    const chave = document.getElementById('ferramentaModelo').value;

    if (canal === 'whatsapp') {
      const comTelefone = selecionadas.filter(function (a) { return telefoneParaWhats(a['Telefone']); });
      const semTelefone = selecionadas.length - comTelefone.length;
      if (!comTelefone.length) { mostrarToast('Nenhuma das selecionadas tem telefone cadastrado.'); return; }

      comTelefone.forEach(function (aluna, indice) {
        setTimeout(function () {
          const whats = telefoneParaWhats(aluna['Telefone']);
          let texto = (CONFIG.modelosWhatsapp[chave] || '').replace(/\{nome\}/g, primeiroNome(aluna['Nome']));
          if (chave === 'solicitarCheckin') texto += linkCheckinPara(aluna['Nome']);
          if (chave === 'solicitarFotos') texto += CONFIG.linkGuiaFotos;
          window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
        }, indice * 450);
      });
      mostrarToast('Abrindo ' + comTelefone.length + ' conversa(s) no WhatsApp' + (semTelefone ? ' (' + semTelefone + ' sem telefone, ignorada(s))' : '') + '. Permita pop-ups se algumas não abrirem.');
    } else {
      const comEmail = selecionadas.filter(function (a) { return a['E-mail']; });
      const semEmail = selecionadas.length - comEmail.length;
      if (!comEmail.length) { mostrarToast('Nenhuma das selecionadas tem e-mail cadastrado.'); return; }

      const modelo = CONFIG.modelosEmail[chave];
      const destinatarios = comEmail.map(function (a) { return { nome: a['Nome'], email: a['E-mail'] }; });
      Api.enviarEmailEmLote(destinatarios, modelo.assunto, modelo.corpo).then(function () {
        mostrarToast('E-mail enviado para ' + comEmail.length + ' aluna(s)' + (semEmail ? ' (' + semEmail + ' sem e-mail, ignorada(s))' : '') + '!');
      });
    }
  };
}

/* ============================================================
   CENTRAL DE AUTOMAÇÕES — gatilhos por inatividade (WhatsApp,
   prontos para 1 clique) + visão das regras automáticas por e-mail.
   ============================================================ */
function renderAutomacoes() {
  const visiveis = alunasVisiveis();

  function diasSemContato(a) {
    return a.ultimoCheckin ? diasDesde(a.ultimoCheckin['Data/Hora']) : null;
  }
  function diasSemFotos(a) {
    if (!a.fotos || !a.fotos.length) return null;
    return diasDesde(a.fotos[a.fotos.length - 1]['Data/Hora']);
  }

  const regras = [
    {
      id: 'atividade',
      titulo: '💬 Sem atividade há ' + CONFIG.diasAlertaCheckin + '+ dias',
      descricao: 'Nenhum check-in recente. Um lembrete carinhoso costuma reativar.',
      modelo: 'lembreteSemanal',
      alunas: visiveis.filter(function (a) {
        const dias = diasSemContato(a);
        return dias === null || dias >= CONFIG.diasAlertaCheckin;
      })
    },
    {
      id: 'fotos',
      titulo: '📸 Sem fotos novas há ' + CONFIG.diasAlertaFotos + '+ dias',
      descricao: 'Hora de pedir fotos de avaliação atualizadas.',
      modelo: 'solicitarFotos',
      alunas: visiveis.filter(function (a) {
        const dias = diasSemFotos(a);
        return dias === null || dias >= CONFIG.diasAlertaFotos;
      })
    },
    {
      id: 'reavaliacao',
      titulo: '📏 Sem contato há ' + CONFIG.diasAlertaReavaliacao + '+ dias',
      descricao: 'Tempo suficiente para sugerir uma reavaliação completa.',
      modelo: 'solicitarReavaliacao',
      alunas: visiveis.filter(function (a) {
        const dias = diasSemContato(a);
        return dias === null || dias >= CONFIG.diasAlertaReavaliacao;
      })
    }
  ];

  const el = document.getElementById('automacoesGatilhos');
  el.innerHTML = regras.map(function (r) {
    const semTelefone = r.alunas.filter(function (a) { return !telefoneParaWhats(a['Telefone']); }).length;
    return '<div class="template-card">' +
      '<div class="tit">' + r.titulo + ' · <span style="color:var(--accent);">' + r.alunas.length + '</span></div>' +
      '<p style="font-size:.82rem; color:var(--ink-soft); margin:.2rem 0 .8rem;">' + r.descricao + '</p>' +
      (r.alunas.length === 0
        ? '<p style="font-size:.82rem; color:var(--ink-faint);">Ninguém se encaixa agora. Tudo em dia! ✅</p>'
        : '<div class="fila-gatilho">' + r.alunas.map(function (a, i) {
            const whats = telefoneParaWhats(a['Telefone']);
            return '<div style="display:flex; align-items:center; justify-content:space-between; gap:.7rem; padding:.5rem 0; border-bottom:1px solid var(--line-soft);">' +
              '<span style="font-size:.86rem;">' + a['Nome'] + '</span>' +
              (whats ? '<button class="btn btn-sm btn-accent" data-gatilho="' + r.id + '" data-indice="' + i + '">💬 Enviar</button>' : '<span style="font-size:.74rem; color:var(--ink-faint);">Sem telefone</span>') +
            '</div>';
          }).join('') + '</div>' +
          (semTelefone > 0 ? '<p style="font-size:.74rem; color:var(--ink-faint); margin-top:.5rem;">' + semTelefone + ' sem telefone cadastrado.</p>' : '')
      ) +
    '</div>';
  }).join('');

  regras.forEach(function (r) {
    el.querySelectorAll('[data-gatilho="' + r.id + '"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const a = r.alunas[parseInt(btn.getAttribute('data-indice'), 10)];
        const whats = telefoneParaWhats(a['Telefone']);
        let texto = (CONFIG.modelosWhatsapp[r.modelo] || '').replace(/\{nome\}/g, primeiroNome(a['Nome']));
        if (r.modelo === 'lembreteSemanal') texto += linkCheckinPara(a['Nome']);
        if (r.modelo === 'solicitarFotos') texto += CONFIG.linkGuiaFotos;
        window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
      });
    });
  });
}

function copiarParaAreaDeTransferencia(texto, callback) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(callback).catch(function () { copiaAlternativa(texto, callback); });
  } else {
    copiaAlternativa(texto, callback);
  }
}
function copiaAlternativa(texto, callback) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  if (callback) callback();
}

document.addEventListener('DOMContentLoaded', function () {
  // ── Links rápidos (copia só o link) ──────────────────────────────────────
  [
    { btnId: 'btnCopiarLinkFicha',    getLink: function () { return CONFIG.linkFicha; },    toast: 'Link da ficha copiado!' },
    { btnId: 'btnCopiarLinkFotos',    getLink: function () { return CONFIG.linkGuiaFotos; }, toast: 'Link do guia de fotos copiado!' },
    { btnId: 'btnCopiarLinkCheckin',  getLink: function () { return CONFIG.linkCheckin; },  toast: 'Link do check-in copiado!' },
    { btnId: 'btnCopiarLinkContrato', getLink: function () { return CONFIG.linkContrato; }, toast: 'Link do contrato copiado!' }
  ].forEach(function (item) {
    var btn = document.getElementById(item.btnId);
    if (!btn) return;
    btn.addEventListener('click', function () {
      copiarParaAreaDeTransferencia(item.getLink() || '', function () { mostrarToast(item.toast); });
    });
  });

  // ── Texto + link (copia mensagem completa) ────────────────────────────────
  document.getElementById('btnCopiarFicha').addEventListener('click', function () {
    CONFIG.modelosWhatsapp.apresentarFicha = document.getElementById('textoApresentarFicha').value;
    salvarConfig(CONFIG);
    const texto = CONFIG.modelosWhatsapp.apresentarFicha + CONFIG.linkFicha;
    copiarParaAreaDeTransferencia(texto, function () { mostrarToast('Texto da ficha copiado!'); });
  });
  document.getElementById('btnCopiarFotos').addEventListener('click', function () {
    CONFIG.modelosWhatsapp.apresentarGuiaFotos = document.getElementById('textoApresentarFotos').value;
    salvarConfig(CONFIG);
    const texto = CONFIG.modelosWhatsapp.apresentarGuiaFotos + CONFIG.linkGuiaFotos;
    copiarParaAreaDeTransferencia(texto, function () { mostrarToast('Texto do guia de fotos copiado!'); });
  });
  document.getElementById('btnCopiarContrato').addEventListener('click', function () {
    CONFIG.modelosWhatsapp.apresentarContrato = document.getElementById('textoApresentarContrato').value;
    salvarConfig(CONFIG);
    const texto = (CONFIG.modelosWhatsapp.apresentarContrato || '') + CONFIG.linkContrato;
    copiarParaAreaDeTransferencia(texto, function () { mostrarToast('Texto do contrato copiado!'); });
  });
});

/* ============================================================
   GESTÃO DE ALUNAS
   ============================================================ */
function renderAlunas() {
  const termo = document.getElementById('buscaAluna').value.trim().toLowerCase();
  const ordem = document.getElementById('ordenarAluna').value;
  const statusFiltro = document.getElementById('filtroStatusAluna').value;
  const mostrarArquivadas = document.getElementById('mostrarArquivadasAluna').checked;
  const riscoFiltro = document.getElementById('filtroRiscoAluna').value;

  // Popula o filtro de etiquetas dinamicamente, com as que realmente existem
  // nas alunas cadastradas — preservando a seleção atual entre re-renders.
  const selEtiqueta = document.getElementById('filtroEtiquetaAluna');
  const valorAtualEtiqueta = (selEtiqueta.value || 'todas').trim();
  const todasEtiquetas = Array.from(new Set(ALUNAS.reduce(function (acc, a) { return acc.concat(etiquetasDe(a)); }, []))).sort();
  selEtiqueta.innerHTML = '<option value="todas">Todas as etiquetas</option>' +
    todasEtiquetas.map(function (t) { return '<option value="' + t.replace(/"/g, '&quot;') + '">' + t + '</option>'; }).join('');
  // Restaura a seleção com comparação normalizada (trim + lowercase) para não depender
  // de capitalização exata ou espaços vindos da planilha.
  const etiquetaParaRestaurar = todasEtiquetas.find(function (t) {
    return t.trim().toLowerCase() === valorAtualEtiqueta.toLowerCase();
  });
  selEtiqueta.value = etiquetaParaRestaurar || 'todas';
  const etiquetaFiltro = selEtiqueta.value;

  let filtradas = ALUNAS.filter(function (a) {
    const g = gestaoDe(a);
    const etiquetas = etiquetasDe(a);
    // Busca ampliada: ficha, etiquetas, check-ins, interações, fotos e anotações.
    const textosCheckins = (a.checkins || []).flatMap(function (c) {
      return [c['Observação'], c['Maior Dificuldade'], c['Onde a Dor'], c['Humor'], c['Semana']];
    });
    const textosInteracoes = (a.interacoes || []).flatMap(function (i) {
      return [i['Observação'], i['Tipo']];
    });
    const textosNotas = [gestaoDe(a).notas];
    const camposBusca = [a['Nome'], a['Telefone'], a['E-mail'], a['Cidade/Estado'], a['Profissão'], a['ID']]
      .concat(etiquetas)
      .concat(textosCheckins)
      .concat(textosInteracoes)
      .concat(textosNotas)
      .filter(Boolean).join(' ').toLowerCase();
    const bateBusca = !termo || camposBusca.indexOf(termo) !== -1;
    const bateStatus = statusFiltro === 'todos' || g.status === statusFiltro;
    const bateArquivado = mostrarArquivadas || g.arquivado !== 'Sim';
    const bateRisco = riscoFiltro === 'todos' || calcularRisco(a).nivel === riscoFiltro;
    // Comparação normalizada: ignora espaços e diferença de capitalização na etiqueta da aluna.
    const bateEtiqueta = etiquetaFiltro === 'todas' || etiquetas.some(function (t) {
      return t.trim().toLowerCase() === etiquetaFiltro.trim().toLowerCase();
    });
    return bateBusca && bateStatus && bateArquivado && bateRisco && bateEtiqueta;
  });

  const ordemNivel = { 'Avançado': 0, 'Intermediário': 1, 'Iniciante': 2 };
  function valorOrdenavelId(id) {
    if (!id) return Infinity; // sem ID vai pro final da lista
    const partes = String(id).match(/(\d+)$/); // pega os dígitos finais, funciona pra ALU-2026-0001 e pra ID antigo tipo "12"
    return partes ? parseInt(partes[1], 10) : Infinity;
  }
  filtradas.sort(function (a, b) {
    if (ordem === 'nome') return String(a['Nome']).localeCompare(String(b['Nome']));
    if (ordem === 'nivel') return (ordemNivel[a['Nível']] ?? 3) - (ordemNivel[b['Nível']] ?? 3);
    if (ordem === 'id') return valorOrdenavelId(a['ID']) - valorOrdenavelId(b['ID']);
    return new Date(b['Data/Hora'] || 0) - new Date(a['Data/Hora'] || 0);
  });

  LISTA_FILTRADA = filtradas;

  const lista = document.getElementById('listaAlunas');
  if (!filtradas.length) {
    lista.innerHTML = '<div class="alert-empty">Nenhuma aluna encontrada.</div>';
    return;
  }

  lista.innerHTML = filtradas.map(function (a, indice) {
    const g = gestaoDe(a);
    const whats = telefoneParaWhats(a['Telefone']);
    const arquivadaClasse = g.arquivado === 'Sim' ? ' arquivada' : '';
    const risco = calcularRisco(a);
    const seloRisco = { critico: '🔴', em_risco: '🟠', atencao: '🟡', excelente: '🟢' }[risco.nivel];
    const tituloRisco = risco.sinais.length ? risco.sinais.map(function (s) { return s.texto; }).join(' · ') : 'Sem pendências';
    const badges = [
      '<span class="badge ' + (a['Nível'] === 'Avançado' ? 'badge-avancado' : a['Nível'] === 'Intermediário' ? 'badge-intermediario' : 'badge-iniciante') + '">' + (a['Nível'] || 'Sem ficha') + '</span>',
      '<span class="badge ' + (g.status === 'Inativo' ? 'badge-inativo' : 'badge-ativo') + '">' + g.status + '</span>',
      '<span class="badge ' + (g.pagamento === 'Devendo' ? 'badge-devendo' : 'badge-pago') + '">' + g.pagamento + (g.pagamento === 'Devendo' && g.valor ? ' R$' + g.valor : '') + '</span>'
    ];
    if (g.arquivado === 'Sim') badges.push('<span class="badge badge-arquivado">Arquivada</span>');
    if (parseInt(a['PAR-Q (positivos)']) > 0) badges.push('<span class="badge badge-risco">PAR-Q</span>');
    etiquetasDe(a).forEach(function (tag) { badges.push('<span class="badge badge-etiqueta">🏷️ ' + tag + '</span>'); });

    return '<div class="aluna-card' + arquivadaClasse + '">' +
      '<div class="aluna-info">' +
        '<div class="nome"><span title="' + tituloRisco.replace(/"/g, '') + '">' + seloRisco + '</span> ' + (a['Nome'] || '—') + (a['ID'] ? ' <span style="color:var(--ink-faint); font-weight:400; font-size:.78rem;">#' + a['ID'] + '</span>' : '') + '</div>' +
        '<div class="meta">' + (a.origem === 'manual' ? 'Cadastro manual' : 'Ficha em ' + formatarData(a['Data/Hora'])) + '</div>' +
        '<div class="aluna-badges">' + badges.join('') + '</div>' +
      '</div>' +
      '<div class="aluna-acoes">' +
        (whats ? '<a class="icon-btn whats" href="https://wa.me/' + whats + '" target="_blank" title="WhatsApp">💬</a>' : '') +
        (a['E-mail'] ? '<a class="icon-btn mail" href="mailto:' + a['E-mail'] + '" title="E-mail">✉️</a>' : '') +
        '<button class="btn btn-sm" data-ver-perfil="' + indice + '">Ver perfil</button>' +
      '</div>' +
    '</div>';
  }).join('');

  lista.querySelectorAll('[data-ver-perfil]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      abrirModalAluna(LISTA_FILTRADA[parseInt(btn.getAttribute('data-ver-perfil'), 10)]);
    });
  });
}

['buscaAluna', 'ordenarAluna', 'filtroStatusAluna', 'mostrarArquivadasAluna', 'filtroRiscoAluna', 'filtroEtiquetaAluna'].forEach(function (id) {
  document.addEventListener('DOMContentLoaded', function () {
    const el = document.getElementById(id);
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', renderAlunas);
  });
});

/* ============================================================
   MODAL DE PERFIL DA ALUNA
   ============================================================ */
function ligarModalAluna() {
  document.getElementById('btnFecharModal').addEventListener('click', function () {
    document.getElementById('modalAluna').classList.remove('show');
  });

  // Fecha o modal clicando fora (no fundo escuro)
  document.getElementById('modalAluna').addEventListener('click', function (e) {
    if (e.target === document.getElementById('modalAluna')) {
      document.getElementById('modalAluna').classList.remove('show');
    }
  });

  document.querySelectorAll('.modal-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.modal-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('tab-' + tab.getAttribute('data-tab')).classList.add('active');

      // Bug 1: rola o modal para o início ao trocar de aba
      const modal = document.querySelector('#modalAluna .modal');
      if (modal) modal.scrollTo({ top: 0, behavior: 'smooth' });

      // Centraliza a aba clicada na barra de abas, para nunca ficar cortada na lateral
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

      // Re-renderiza abas pesadas só quando ativadas
      if (!ALUNA_ATUAL) return;
      const nomeAba = tab.getAttribute('data-tab');
      if (nomeAba === 'progresso') { renderTabProgresso(ALUNA_ATUAL); }
      if (nomeAba === 'checkins') renderTabCheckins(ALUNA_ATUAL);
      if (nomeAba === 'timeline') renderTabTimeline(ALUNA_ATUAL);
      if (nomeAba === 'financeiro') renderTabFinanceiro(ALUNA_ATUAL, gestaoDe(ALUNA_ATUAL));
      if (nomeAba === 'acoes') renderTabAcoes(ALUNA_ATUAL);
      if (nomeAba === 'relatorio') renderTabRelatorio(ALUNA_ATUAL);
    });
  });
}

let ALUNA_ATUAL = null;

function abrirModalAluna(aluna) {
  ALUNA_ATUAL = aluna;
  const g = gestaoDe(aluna);
  document.getElementById('modalAlunaNome').textContent = aluna['Nome'] || '—';
  document.getElementById('modalAlunaSub').textContent = (aluna['ID'] ? '#' + aluna['ID'] + ' · ' : '') + (aluna.origem === 'manual' ? 'Cadastro manual, sem ficha de anamnese' : 'Nível ' + (aluna['Nível'] || '—'));

  renderTabResumo(aluna);
  renderTabOnboarding(aluna);
  renderTabTimeline(aluna);
  renderTabInteracoes(aluna);
  renderTabCheckins(aluna);
  renderTabProgresso(aluna);
  renderTabFinanceiro(aluna, g);
  renderTabAcoes(aluna);

  const modalTabsEl = document.querySelector('.modal-tabs');
  if (modalTabsEl) modalTabsEl.scrollLeft = 0;

  document.querySelectorAll('.modal-tab')[0].click();
  document.getElementById('modalAluna').classList.add('show');
}

function linhaInfo(label, valor) {
  return '<div><b>' + label + '</b>' + (valor || valor === 0 ? valor : '—') + '</div>';
}

function renderTabResumo(a) {
  const el = document.getElementById('tab-resumo');
  if (a.origem === 'manual') {
    el.innerHTML = blocoContrato(a) + '<p style="color:var(--ink-soft);">Esta aluna foi cadastrada manualmente, sem ficha de anamnese preenchida.</p>';
    return;
  }

  // Recalcula peso/altura/IMC na hora de exibir, corrigindo o caso comum de
  // alguém digitar a altura em metros (1,56) em vez de centímetros (156).
  // Isso protege também fichas antigas, enviadas antes dessa correção existir.
  const pesoNum = parseFloat(a['Peso (kg)']);
  let alturaNum = parseFloat(a['Altura (cm)']);
  if (alturaNum && alturaNum < 3) alturaNum = alturaNum * 100;
  let imcTexto = '';
  if (pesoNum && alturaNum) {
    const imc = pesoNum / Math.pow(alturaNum / 100, 2);
    let classe = 'Abaixo do peso';
    if (imc >= 18.5 && imc < 25) classe = 'Peso normal';
    else if (imc >= 25 && imc < 30) classe = 'Sobrepeso';
    else if (imc >= 30 && imc < 35) classe = 'Obesidade grau I';
    else if (imc >= 35 && imc < 40) classe = 'Obesidade grau II';
    else if (imc >= 40) classe = 'Obesidade grau III';
    imcTexto = imc.toFixed(1) + ' (' + classe + ')';
  }

  el.innerHTML = blocoContrato(a) + '<div class="info-grid">' +
    linhaInfo('Nome', a['Nome']) +
    linhaInfo('Idade', a['Idade'] ? a['Idade'] + ' anos' : '') +
    linhaInfo('Cidade/Estado', a['Cidade/Estado']) +
    linhaInfo('Profissão', a['Profissão']) +
    linhaInfo('Telefone', a['Telefone']) +
    linhaInfo('E-mail', a['E-mail']) +
    linhaInfo('Objetivo principal', a['Objetivo Principal']) +
    linhaInfo('Objetivos secundários', a['Objetivos Secundários']) +
    linhaInfo('Histórico de treino', [a['Já Treinou'], a['Tempo de Prática'], a['Frequência Atual'] ? a['Frequência Atual'] + 'x/semana' : ''].filter(Boolean).join(' · ')) +
    linhaInfo('Limitações', a['Restrição de Movimento']) +
    linhaInfo('Lesões', [a['Lesão Atual'], a['Região da Lesão'], a['Detalhe da Lesão']].filter(Boolean).join(' · ')) +
    linhaInfo('Medicamentos', a['Medicamentos']) +
    linhaInfo('Sono', [a['Qualidade do Sono'], a['Horas de Sono'] ? a['Horas de Sono'] + 'h/noite' : ''].filter(Boolean).join(' · ')) +
    linhaInfo('Alimentação', [a['Refeições/dia'] ? a['Refeições/dia'] + ' refeições/dia' : '', a['Restrições Alimentares']].filter(Boolean).join(' · ')) +
    linhaInfo('Peso', pesoNum ? pesoNum + ' kg' : '') +
    linhaInfo('Altura', alturaNum ? alturaNum + ' cm' : '') +
    linhaInfo('IMC', imcTexto) +
    linhaInfo('PAR-Q', parseInt(a['PAR-Q (positivos)']) > 0 ? '⚠ ' + a['PAR-Q (positivos)'] + ' sinal(is) positivo(s)' : 'Sem sinais') +
    linhaInfo('Observações', a['Observações Finais']) +
  '</div>';
}

function renderTabOnboarding(a) {
  const el = document.getElementById('tab-onboarding');
  const ob = calcularOnboarding(a);

  el.innerHTML =
    '<div style="margin-bottom:1.4rem;">' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:.4rem;">' +
        '<span style="font-size:.85rem; color:var(--ink-soft);">Progresso</span>' +
        '<span style="font-size:.85rem; font-weight:700;">' + ob.completos + '/' + ob.total + '</span>' +
      '</div>' +
      '<div style="background:var(--line-soft); border-radius:999px; height:8px; overflow:hidden;">' +
        '<div style="background:' + (ob.completo ? 'var(--ok)' : 'var(--accent)') + '; height:100%; width:' + ob.percentual + '%; transition:width .3s var(--ease);"></div>' +
      '</div>' +
    '</div>' +
    ob.passos.map(function (p) {
      return '<div style="display:flex; align-items:center; gap:.7rem; padding:.6rem 0; border-bottom:1px solid var(--line-soft);">' +
        '<div style="font-size:1.1rem;">' + (p.feito ? '✅' : '⬜') + '</div>' +
        '<div style="font-size:.88rem; color:' + (p.feito ? 'var(--ink)' : 'var(--ink-soft)') + ';">' + p.label + '</div>' +
      '</div>';
    }).join('') +
    (ob.completo ? '<p style="margin-top:1rem; color:var(--ok); font-weight:600; font-size:.88rem;">🎉 Onboarding completo!</p>' : '');
}

function renderTabTimeline(a) {
  const el = document.getElementById('tab-timeline');
  const eventos = [];

  if (a['Data/Hora'] && a.origem !== 'manual') {
    eventos.push({ quando: a['Data/Hora'], icone: '📝', texto: 'Entrou na consultoria (ficha de anamnese)' });
  }
  (a.checkins || []).forEach(function (c) {
    const detalhe = [c['Peso'] ? c['Peso'] + 'kg' : '', c['Humor'] || ''].filter(Boolean).join(' · ');
    eventos.push({ quando: c['Data/Hora'], icone: '💬', texto: 'Check-in' + (detalhe ? ' — ' + detalhe : '') });
  });
  (a.fotos || []).forEach(function (f) {
    eventos.push({ quando: f['Data/Hora'], icone: '📸', texto: 'Enviou fotos de progresso' });
  });
  (a.evolucao || []).forEach(function (m) {
    const partes = [];
    if (m['Peso']) partes.push(m['Peso'] + 'kg');
    if (m['Cintura']) partes.push('cintura ' + m['Cintura'] + 'cm');
    eventos.push({ quando: m['Data/Hora'], icone: '📏', texto: 'Atualizou medidas' + (partes.length ? ' — ' + partes.join(', ') : '') });
  });
  if (a.contrato && a.contrato['Status'] === 'Aceito') {
    eventos.push({ quando: a.contrato['Data Aceite'], icone: '📄', texto: 'Aceitou o contrato digital' });
  }

  eventos.sort(function (x, y) { return new Date(y.quando) - new Date(x.quando); });

  if (!eventos.length) {
    el.innerHTML = '<p style="color:var(--ink-soft);">Nenhum evento registrado ainda.</p>';
    return;
  }

  el.innerHTML = eventos.map(function (e) {
    return '<div style="display:flex; gap:.8rem; padding:.7rem 0; border-bottom:1px solid var(--line-soft);">' +
      '<div style="font-size:1.1rem; flex-shrink:0;">' + e.icone + '</div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:.88rem;">' + e.texto + '</div>' +
        '<div style="font-size:.75rem; color:var(--ink-soft);">' + formatarDataHora(e.quando) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderTabInteracoes(a) {
  const el = document.getElementById('tab-interacoes');
  const lista = a.interacoes || [];

  // ── BLOCO DE ANOTAÇÕES PESSOAIS ──────────────────────────────────────────
  // Salvo dentro de gestao para não precisar de nova rota na API.
  const notaAtual = (gestaoDe(a).notas || '');

  const blocoNotas =
    '<div style="margin-bottom:1.6rem; padding-bottom:1.4rem; border-bottom:1px solid var(--line-soft);">' +
      '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.55rem;">' +
        '<label style="font-size:.84rem; font-weight:600; color:var(--ink-soft); margin:0;">📌 Minhas anotações sobre ' + primeiroNome(a['Nome']) + '</label>' +
        '<span id="notaStatus" style="font-size:.72rem; color:var(--ink-faint); transition:opacity .3s;"></span>' +
      '</div>' +
      '<textarea id="notasAluna" rows="4" placeholder="Preferências, detalhes pessoais, alertas importantes... Só você vê isso." ' +
        'style="width:100%; resize:vertical; font-size:.87rem; line-height:1.6; background:var(--paper-soft, #F7F4F2); border:1px solid var(--line, rgba(26,23,20,.10)); border-radius:8px; padding:.7rem .9rem; font-family:inherit; color:var(--ink);">' +
        notaAtual +
      '</textarea>' +
    '</div>';

  // ── HISTÓRICO DE INTERAÇÕES ───────────────────────────────────────────────
  const historico = !lista.length
    ? '<p style="color:var(--ink-soft);">Nenhuma interação registrada ainda.</p>'
    : '<div style="margin-bottom:1.4rem;">' + lista.map(function (i) {
        return '<div style="display:flex; gap:.8rem; padding:.7rem 0; border-bottom:1px solid var(--line-soft);">' +
          '<div style="font-size:1.1rem; flex-shrink:0;">💬</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:.88rem;"><b>' + (i['Tipo'] || 'Outro') + '</b>' + (i['Observação'] ? ': ' + i['Observação'] : '') + '</div>' +
            '<div style="font-size:.75rem; color:var(--ink-soft);">' + formatarDataHora(i['Data/Hora']) + '</div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';

  el.innerHTML = blocoNotas + historico +
    '<h3 style="font-size:.95rem; margin-bottom:.7rem;">Registrar nova interação</h3>' +
    '<div class="form-grid">' +
      '<div class="form-field"><label>Tipo</label><select id="iTipo">' +
        '<option value="Mensagem">💬 Mensagem</option>' +
        '<option value="Ligação">📞 Ligação</option>' +
        '<option value="Check-in cobrado">⏰ Check-in cobrado</option>' +
        '<option value="Visita">🤝 Visita/Presencial</option>' +
        '<option value="Outro">📌 Outro</option>' +
      '</select></div>' +
      '<div class="form-field"><label>Observação (opcional)</label><input type="text" id="iObservacao" placeholder="Ex.: confirmou presença no treino"></div>' +
    '</div>' +
    '<button class="btn btn-accent" id="btnRegistrarInteracao">+ Registrar interação</button>';

  // ── SALVAR ANOTAÇÕES (ao sair do campo ou após 1,5s parado) ──────────────
  const campoNota = document.getElementById('notasAluna');
  const statusEl  = document.getElementById('notaStatus');
  let timerNota;

  function salvarNota() {
    const texto = campoNota.value;
    if (texto === (gestaoDe(a).notas || '')) return; // nada mudou
    statusEl.textContent = 'Salvando…';
    statusEl.style.opacity = '1';
    const g = gestaoDe(a);
    const dados = Object.assign({}, g, { nome: a['Nome'], telefone: a['Telefone'] || '', notas: texto });
    Api.salvarGestaoAluna(dados).then(function () {
      if (!a.gestao) a.gestao = {};
      a.gestao.notas = texto;
      statusEl.textContent = '✓ Salvo';
      setTimeout(function () { statusEl.style.opacity = '0'; }, 1800);
    }).catch(function () {
      statusEl.textContent = '⚠ Erro ao salvar';
    });
  }

  campoNota.addEventListener('input', function () {
    clearTimeout(timerNota);
    statusEl.textContent = '';
    timerNota = setTimeout(salvarNota, 1500); // auto-salva 1,5s após parar de digitar
  });
  campoNota.addEventListener('blur', function () {
    clearTimeout(timerNota);
    salvarNota();
  });

  // ── REGISTRAR INTERAÇÃO ───────────────────────────────────────────────────
  document.getElementById('btnRegistrarInteracao').addEventListener('click', function () {
    const tipo = document.getElementById('iTipo').value;
    const observacao = document.getElementById('iObservacao').value;
    Api.enviarAcao({ tipo: 'interacao', nome: a['Nome'], tipoInteracao: tipo, observacao: observacao }).then(function () {
      mostrarToast('✓ Interação registrada!');
      a.interacoes = [{ 'Data/Hora': new Date().toISOString(), 'Nome': a['Nome'], 'Tipo': tipo, 'Observação': observacao }].concat(a.interacoes || []);
      a.ultimaInteracao = a.interacoes[0];
      renderTabInteracoes(a);
      if (typeof renderDashboard === 'function') renderDashboard();
    });
  });
}

function renderTabCheckins(a) {
  const el = document.getElementById('tab-checkins');
  const lista = a.checkins || [];
  if (!lista.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Nenhum check-in registrado ainda.</p>'; return; }

  // Para cada check-in mensal/trimestral, verifica se há foto enviada próxima (janela de 7 dias)
  function fotoProxima(dataCheckin) {
    const dtCk = new Date(dataCheckin);
    if (isNaN(dtCk.getTime())) return false;
    return (a.fotos || []).some(function (f) {
      const dtFoto = new Date(f['Data/Hora']);
      if (isNaN(dtFoto.getTime())) return false;
      return Math.abs(dtFoto - dtCk) <= 7 * 86400000;
    });
  }

  function linhaTabela(c, comFotos) {
    const emojiHumor = { 'Animada': '😊', 'Tranquila': '🙂', 'Cansada': '😮\u200d💨', 'Estressada': '😣', 'Desanimada': '😔' };
    const seloFoto = comFotos
      ? (fotoProxima(c['Data/Hora'])
          ? '<span title="Fotos enviadas neste período" style="color:var(--ok,#3E6650);">📸 ✓</span>'
          : '<span title="Fotos não enviadas neste período" style="color:var(--ink-faint);">📸 —</span>')
      : '';
    return '<tr><td>' + formatarDataHora(c['Data/Hora']) + '</td><td>' + (c['Peso'] || '—') + '</td><td>' + (c['Semana'] || '—') + '</td><td>' + (c['Energia'] ?? '—') + '/10</td><td>' + (c['Humor'] ? (emojiHumor[c['Humor']] || '') + ' ' + c['Humor'] : '—') + '</td><td>' + (c['Dor'] === 'Sim' ? '⚠ ' + (c['Onde a Dor'] || 'sim') : 'Não') + '</td><td>' + (c['Maior Dificuldade'] || '—') + '</td><td>' + (c['Observação'] || '—') + '</td>' + (comFotos ? '<td>' + seloFoto + '</td>' : '') + '</tr>';
  }

  function blocoTipo(tipo, emoji) {
    const doTipo = lista.filter(function (c) { return (c['Tipo'] || 'Semanal') === tipo; });
    const comFotos = tipo === 'Mensal' || tipo === 'Trimestral';
    if (!doTipo.length) {
      return '<div style="margin-bottom:1.6rem;"><span class="eyebrow">' + emoji + ' ' + tipo + '</span><p style="color:var(--ink-faint); font-size:.84rem;">Nenhum check-in ' + tipo.toLowerCase() + ' ainda.</p></div>';
    }
    const thFotos = comFotos ? '<th>Fotos</th>' : '';
    return '<div style="margin-bottom:1.6rem;">' +
      '<span class="eyebrow">' + emoji + ' ' + tipo + ' · ' + doTipo.length + '</span>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Peso</th><th>Avaliação</th><th>Energia</th><th>Humor</th><th>Dor</th><th>Dificuldade</th><th>Observação</th>' + thFotos + '</tr></thead><tbody>' +
      doTipo.map(function (c) { return linhaTabela(c, comFotos); }).join('') +
      '</tbody></table></div></div>';
  }

  el.innerHTML = blocoTipo('Semanal', '📅') + blocoTipo('Mensal', '🗓️') + blocoTipo('Trimestral', '📆');
}

function gerarGraficoLinhaSVG(pontos) {
  // pontos: [{x: Date, y: number, rotulo: string}], em ordem cronológica
  const largura = 600, altura = 170, margemEsq = 38, margemDir = 14, margemTopo = 16, margemBaixo = 28;
  const areaLargura = largura - margemEsq - margemDir;
  const areaAltura = altura - margemTopo - margemBaixo;

  const valores = pontos.map(function (p) { return p.y; });
  let minY = Math.min.apply(null, valores), maxY = Math.max.apply(null, valores);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const folga = (maxY - minY) * 0.15;
  minY -= folga; maxY += folga;

  const minX = pontos[0].x.getTime(), maxX = pontos[pontos.length - 1].x.getTime();
  const intervaloX = maxX - minX || 1;

  function escalaX(t) { return margemEsq + ((t - minX) / intervaloX) * areaLargura; }
  function escalaY(v) { return margemTopo + areaAltura - ((v - minY) / (maxY - minY)) * areaAltura; }

  const coords = pontos.map(function (p) { return [escalaX(p.x.getTime()), escalaY(p.y)]; });
  const linha = coords.map(function (c, i) { return (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' ');

  const pontosSvg = coords.map(function (c, i) {
    return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="3.5" fill="#7C1B2A"></circle>' +
      (i === 0 || i === coords.length - 1 ? '<text x="' + c[0].toFixed(1) + '" y="' + (c[1] - 9).toFixed(1) + '" font-size="11" text-anchor="middle" fill="#18181A" font-weight="600">' + pontos[i].y + '</text>' : '');
  }).join('');

  const rotuloEsq = '<text x="' + margemEsq + '" y="' + (altura - 8) + '" font-size="10" fill="#9A9A9D">' + pontos[0].rotulo + '</text>';
  const rotuloDir = '<text x="' + (largura - margemDir) + '" y="' + (altura - 8) + '" font-size="10" text-anchor="end" fill="#9A9A9D">' + pontos[pontos.length - 1].rotulo + '</text>';

  return '<svg viewBox="0 0 ' + largura + ' ' + altura + '" style="width:100%; height:auto; max-width:600px;">' +
    '<line x1="' + margemEsq + '" y1="' + (margemTopo + areaAltura) + '" x2="' + (largura - margemDir) + '" y2="' + (margemTopo + areaAltura) + '" stroke="#E7E3E0" stroke-width="1"></line>' +
    '<path d="' + linha + '" fill="none" stroke="#7C1B2A" stroke-width="2.2"></path>' +
    pontosSvg + rotuloEsq + rotuloDir +
  '</svg>';
}

function renderTabProgresso(a) {
  const el = document.getElementById('tab-progresso');
  if (!el) return;
  el.innerHTML = '';
  renderTabEvolucao(a);
  renderTabFotos(a);
}

function renderTabEvolucao(a) {
  const el = document.getElementById('tab-progresso');
  el.innerHTML = '<span class="eyebrow">Evolução de peso</span>';
  const comPeso = (a.checkins || []).filter(function (c) { return c['Peso']; }).slice().reverse(); // ordem cronológica
  if (!comPeso.length) { el.innerHTML += '<p style="color:var(--ink-soft);">Ainda não há registros de peso suficientes para mostrar evolução.</p>'; return; }
  const primeiro = parseFloat(comPeso[0]['Peso']);
  const ultimo = parseFloat(comPeso[comPeso.length - 1]['Peso']);
  const diferenca = (ultimo - primeiro).toFixed(1);

  let html = '<p style="font-size:.9rem;"><b>Variação total:</b> ' + (diferenca > 0 ? '+' : '') + diferenca + ' kg desde o primeiro registro (' + formatarData(comPeso[0]['Data/Hora']) + ').</p>';

  if (comPeso.length >= 2) {
    const pontosGrafico = comPeso.map(function (c) {
      return { x: new Date(c['Data/Hora']), y: parseFloat(c['Peso']), rotulo: formatarData(c['Data/Hora']) };
    });
    html += '<div style="margin:1rem 0 1.4rem;">' + gerarGraficoLinhaSVG(pontosGrafico) + '</div>';
  }

  html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Peso (kg)</th></tr></thead><tbody>' +
    comPeso.slice().reverse().map(function (c) { return '<tr><td>' + formatarData(c['Data/Hora']) + '</td><td>' + c['Peso'] + '</td></tr>'; }).join('') +
    '</tbody></table></div>';

  el.innerHTML += html;
  if (!url || url === '—') return null;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
function miniaturaDrive(url) {
  const id = extrairIdDrive(url);
  return id ? 'https://lh3.googleusercontent.com/d/' + id + '=s400' : null;
}

/* Quando a aluna envia fotos em mais de um momento do mesmo dia (por
   exemplo, esqueceu uma pose e mandou de novo depois), isso gera mais de
   uma linha na planilha para o mesmo dia, cada uma com poses diferentes
   preenchidas. Essa função junta tudo num único registro por dia,
   completando as poses que faltam em um envio com as que vieram no outro
   — assim o dia aparece completo na tela, em vez de espalhado e confuso. */
function mesclarFotosPorDia(fotos) {
  const porDia = {};
  const ordemOriginal = fotos.slice().sort(function (x, y) { return new Date(x['Data/Hora']) - new Date(y['Data/Hora']); });

  ordemOriginal.forEach(function (f) {
    const data = new Date(f['Data/Hora']);
    const chaveDia = isNaN(data.getTime()) ? String(f['Data/Hora']) : data.toDateString();
    if (!porDia[chaveDia]) {
      porDia[chaveDia] = Object.assign({}, f);
    } else {
      // Mantém a data/hora mais recente do dia, mas só substitui cada pose
      // se o envio mais novo realmente trouxe uma foto nova para ela.
      porDia[chaveDia]['Data/Hora'] = f['Data/Hora'];
      ['Foto Frente', 'Foto Perfil', 'Foto Costas'].forEach(function (campo) {
        if (f[campo] && f[campo] !== '—') porDia[chaveDia][campo] = f[campo];
      });
    }
  });

  return Object.keys(porDia).map(function (k) { return porDia[k]; });
}

function renderTabFotos(a) {
  const el = document.getElementById('tab-progresso');
  const lista = mesclarFotosPorDia(a.fotos || []).sort(function (x, y) { return new Date(y['Data/Hora']) - new Date(x['Data/Hora']); });
  const separador = '<hr style="border:none; border-top:1px solid var(--line); margin:1.6rem 0;">';
  if (!lista.length) { el.innerHTML += separador + '<p style="color:var(--ink-soft);">Nenhuma foto enviada ainda.</p>'; return; }

  const cronologica = lista.slice().reverse(); // mais antiga primeiro, para a comparação
  const opcoesData = cronologica.map(function (f, i) {
    return '<option value="' + i + '">' + formatarData(f['Data/Hora']) + '</option>';
  }).join('');

  let html = separador + '<span class="eyebrow">Fotos</span>';
  if (cronologica.length >= 2) {
    html += '<div style="margin-bottom:1.8rem; padding-bottom:1.6rem; border-bottom:1px solid var(--line);">' +
      '<span class="eyebrow">Comparar</span><h3 style="font-size:.95rem; margin-bottom:.8rem;">Antes e depois</h3>' +
      '<div class="form-grid" style="margin-bottom:.9rem;">' +
        '<div class="form-field"><label>Antes</label><select id="comparaAntes">' + opcoesData + '</select></div>' +
        '<div class="form-field"><label>Depois</label><select id="comparaDepois">' + opcoesData + '</select></div>' +
      '</div>' +
      '<div id="resultadoComparacao"></div>' +
    '</div>';
  }

  html += '<div class="fotos-grid">' + lista.map(function (f) {
    let imgs = '';
    [['Foto Frente', 'Frente'], ['Foto Perfil', 'Perfil'], ['Foto Costas', 'Costas']].forEach(function (par) {
      const urlOriginal = f[par[0]];
      const thumb = miniaturaDrive(urlOriginal);
      if (!thumb) return;
      imgs += '<a href="' + urlOriginal + '" target="_blank" class="foto-thumb">' +
        '<img src="' + thumb + '" alt="' + par[1] + '" loading="lazy">' +
        '<span>' + par[1] + '</span>' +
      '</a>';
    });
    return '<div class="foto-data-bloco"><div class="data-foto">' + formatarData(f['Data/Hora']) + '</div><div class="foto-thumbs-row">' + (imgs || '<span style="color:var(--ink-soft); font-size:.78rem;">Sem imagem visível (enviada antes do ajuste de compartilhamento)</span>') + '</div></div>';
  }).join('') + '</div>';

  el.innerHTML += html;

  if (cronologica.length >= 2) {
    function montarComparacao() {
      const iAntes = parseInt(document.getElementById('comparaAntes').value, 10);
      const iDepois = parseInt(document.getElementById('comparaDepois').value, 10);
      const fAntes = cronologica[iAntes];
      const fDepois = cronologica[iDepois];
      const poses = [['Foto Frente', 'Frente'], ['Foto Perfil', 'Perfil'], ['Foto Costas', 'Costas']];
      let saida = '<div style="display:flex; gap:1.5rem; flex-wrap:wrap;">';
      poses.forEach(function (par) {
        const tAntes = miniaturaDrive(fAntes[par[0]]);
        const tDepois = miniaturaDrive(fDepois[par[0]]);
        if (!tAntes && !tDepois) return;
        saida += '<div>' +
          '<div style="font-size:.78rem; font-weight:600; color:var(--ink-soft); margin-bottom:.4rem;">' + par[1] + '</div>' +
          '<div style="display:flex; gap:.5rem;">' +
            (tAntes ? '<a href="' + fAntes[par[0]] + '" target="_blank"><img src="' + tAntes + '" style="width:130px; height:163px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--line);"></a>' : '<div style="width:130px; height:163px; background:var(--paper-soft); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; color:var(--ink-faint); font-size:.72rem;">Sem foto</div>') +
            (tDepois ? '<a href="' + fDepois[par[0]] + '" target="_blank"><img src="' + tDepois + '" style="width:130px; height:163px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--line);"></a>' : '<div style="width:130px; height:163px; background:var(--paper-soft); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; color:var(--ink-faint); font-size:.72rem;">Sem foto</div>') +
          '</div>' +
        '</div>';
      });
      saida += '</div>';
      document.getElementById('resultadoComparacao').innerHTML = saida;
    }
    document.getElementById('comparaDepois').value = String(cronologica.length - 1);
    montarComparacao();
    document.getElementById('comparaAntes').addEventListener('change', montarComparacao);
    document.getElementById('comparaDepois').addEventListener('change', montarComparacao);
  }
}

function dataParaInputDate(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function renderTabFinanceiro(a, g) {
  const el = document.getElementById('tab-financeiro');
  const SUGESTOES_ETIQUETAS = ['VIP', 'Gestante', 'Pós-parto', 'Terceira idade', 'Lesão', 'Indicação', 'Iniciante na consultoria'];
  let etiquetasAtuais = etiquetasDe(a);

  function renderChipsEtiquetas() {
    const chipsEl = document.getElementById('etiquetasChips');
    if (!chipsEl) return;
    const todasOpcoes = SUGESTOES_ETIQUETAS.concat(etiquetasAtuais.filter(function (t) { return SUGESTOES_ETIQUETAS.indexOf(t) === -1; }));
    chipsEl.innerHTML = todasOpcoes.map(function (t) {
      const ativa = etiquetasAtuais.indexOf(t) !== -1;
      return '<button type="button" class="etiqueta-chip' + (ativa ? ' ativa' : '') + '" data-etiqueta-chip="' + t.replace(/"/g, '&quot;') + '">' + t + '</button>';
    }).join('');
    chipsEl.querySelectorAll('[data-etiqueta-chip]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        const valor = chip.getAttribute('data-etiqueta-chip');
        const indice = etiquetasAtuais.indexOf(valor);
        if (indice === -1) etiquetasAtuais.push(valor); else etiquetasAtuais.splice(indice, 1);
        renderChipsEtiquetas();
      });
    });
  }

  el.innerHTML =
    '<div class="form-grid">' +
      '<div class="form-field"><label>Status</label><select id="fStatus"><option value="Ativo"' + (g.status === 'Ativo' ? ' selected' : '') + '>Ativo</option><option value="Inativo"' + (g.status === 'Inativo' ? ' selected' : '') + '>Inativo</option></select></div>' +
      '<div class="form-field"><label>Pagamento</label><select id="fPagamento"><option value="Pago"' + (g.pagamento === 'Pago' ? ' selected' : '') + '>Pago</option><option value="Devendo"' + (g.pagamento === 'Devendo' ? ' selected' : '') + '>Devendo</option></select></div>' +
      '<div class="form-field"><label>Plano</label><input type="text" id="fPlano" value="' + (g.plano !== '—' ? g.plano : '') + '"></div>' +
      '<div class="form-field"><label>Valor (R$)</label><input type="number" step="0.01" id="fValor" value="' + (g.valor || '') + '"></div>' +
      '<div class="form-field"><label>Próxima renovação</label><input type="date" id="fRenovacao" value="' + (g.proximaRenovacao || '') + '"></div>' +
      '<div class="form-field"><label>Arquivada</label><select id="fArquivado"><option value="Não"' + (g.arquivado !== 'Sim' ? ' selected' : '') + '>Não</option><option value="Sim"' + (g.arquivado === 'Sim' ? ' selected' : '') + '>Sim</option></select></div>' +
      '<div class="form-field"><label>🎂 Data de nascimento</label><input type="date" id="fNascimento" value="' + dataParaInputDate(a['Data de Nascimento']) + '"></div>' +
    '</div>' +
    '<div class="form-field" style="margin-top:.4rem;">' +
      '<label>🏷️ Etiquetas</label>' +
      '<div id="etiquetasChips" style="display:flex; flex-wrap:wrap; gap:.4rem; margin-bottom:.6rem;"></div>' +
      '<div style="display:flex; gap:.5rem;">' +
        '<input type="text" id="fNovaEtiqueta" placeholder="Criar etiqueta nova..." style="flex:1;">' +
        '<button type="button" class="btn btn-sm" id="btnAdicionarEtiqueta">+ Adicionar</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-top:1rem; align-items:center;">' +
      '<button class="btn btn-primary" id="btnSalvarFinanceiro">Salvar</button>' +
      '<button class="btn btn-accent" id="btnRenovarPlano">🔄 Renovar plano</button>' +
      '<button class="btn btn-sm" id="btnLancarMesPago">➕ Lançar mês anterior</button>' +
      '<button class="btn btn-danger" id="btnExcluirAluna" style="margin-left:auto;">Excluir aluna</button>' +
    '</div>' +
    // Mini-modal inline de renovação (oculto por padrão)
    '<div id="renovacaoPanel" style="display:none; margin-top:1rem; padding:1rem 1.1rem; background:var(--paper-soft,#F7F4F2); border:1px solid var(--line,rgba(26,23,20,.12)); border-radius:10px;">' +
      '<div style="font-size:.88rem; font-weight:600; margin-bottom:.8rem; color:var(--ink);">🔄 Renovar plano de ' + primeiroNome(a['Nome']) + '</div>' +
      '<div class="form-grid" style="grid-template-columns:1fr 1fr; gap:.7rem;">' +
        '<div class="form-field">' +
          '<label>Avançar quantos dias?</label>' +
          '<div style="display:flex; gap:.35rem; flex-wrap:wrap; margin-bottom:.4rem;">' +
            '<button type="button" class="btn btn-sm dias-rapido" data-dias="30">30d</button>' +
            '<button type="button" class="btn btn-sm dias-rapido" data-dias="60">60d</button>' +
            '<button type="button" class="btn btn-sm dias-rapido" data-dias="90">90d</button>' +
            '<button type="button" class="btn btn-sm dias-rapido" data-dias="180">180d</button>' +
          '</div>' +
          '<input type="number" id="renovDias" placeholder="Ou digite aqui..." min="1" max="730">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Mês de referência do pagamento</label>' +
          '<input type="month" id="renovMes">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex; gap:.5rem; margin-top:.8rem;">' +
        '<button class="btn btn-primary" id="btnConfirmarRenovacao">✓ Confirmar renovação</button>' +
        '<button class="btn btn-ghost" id="btnCancelarRenovacao">Cancelar</button>' +
      '</div>' +
    '</div>' +
    (function () {
      var historico = a.historicoPagamentos || [];
      if (!historico.length) {
        return '<div style="margin-top:1.6rem; padding-top:1.2rem; border-top:1px solid var(--line-soft);">' +
          '<span class="eyebrow">Histórico de pagamentos</span>' +
          '<p style="color:var(--ink-soft); font-size:.85rem; margin-top:.4rem;">Nenhum pagamento registrado ainda. O histórico começa a ser gravado a partir do próximo pagamento confirmado.</p>' +
        '</div>';
      }
      var meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      var linhas = historico.map(function (h) {
        var mesAno = String(h['Mês/Ano'] || '');
        var partes = mesAno.split('-');
        var rotulo = partes.length === 2 ? (meses[parseInt(partes[1], 10) - 1] || partes[1]) + '/' + partes[0] : mesAno;
        var dataReg = h['Data do Registro'] ? formatarData(h['Data do Registro']) : '—';
        var status = String(h['Status'] || 'Pago');
        var cor = status === 'Pago' ? 'var(--ok, #3E6650)' : '#C0392B';
        return '<tr><td style="font-weight:600;">' + rotulo + '</td><td style="color:' + cor + '; font-weight:600;">' + status + '</td><td style="color:var(--ink-soft);">' + dataReg + '</td></tr>';
      }).join('');
      return '<div style="margin-top:1.6rem; padding-top:1.2rem; border-top:1px solid var(--line-soft);">' +
        '<span class="eyebrow">Histórico de pagamentos</span>' +
        '<div class="table-wrap" style="margin-top:.6rem;">' +
          '<table class="data-table"><thead><tr><th>Mês</th><th>Status</th><th>Registrado em</th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table>' +
        '</div></div>';
    }());

  renderChipsEtiquetas();

  document.getElementById('btnAdicionarEtiqueta').addEventListener('click', function () {
    const campo = document.getElementById('fNovaEtiqueta');
    const valor = campo.value.trim();
    if (!valor) return;
    if (etiquetasAtuais.indexOf(valor) === -1) etiquetasAtuais.push(valor);
    campo.value = '';
    renderChipsEtiquetas();
  });


  // ── RENOVAÇÃO DE PLANO ────────────────────────────────────────────────────
  document.getElementById('btnRenovarPlano').addEventListener('click', function () {
    const painel = document.getElementById('renovacaoPanel');
    painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
    if (painel.style.display === 'block') {
      // Pré-preenche o mês com o mês atual
      const hoje = new Date();
      document.getElementById('renovMes').value = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
      // Pré-preenche os dias com base na próxima renovação atual (se existir)
      document.getElementById('renovDias').value = '';
    }
  });

  document.getElementById('btnCancelarRenovacao').addEventListener('click', function () {
    document.getElementById('renovacaoPanel').style.display = 'none';
  });

  // Botões rápidos de dias
  document.getElementById('renovacaoPanel').querySelectorAll('.dias-rapido').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById('renovDias').value = btn.getAttribute('data-dias');
      document.getElementById('renovacaoPanel').querySelectorAll('.dias-rapido').forEach(function (b) { b.classList.remove('btn-accent'); });
      btn.classList.add('btn-accent');
    });
  });

  document.getElementById('btnConfirmarRenovacao').addEventListener('click', function () {
    const diasStr = document.getElementById('renovDias').value.trim();
    const mesRef = document.getElementById('renovMes').value.trim();

    const dias = parseInt(diasStr, 10);
    if (!dias || dias < 1 || dias > 730) {
      mostrarToast('Informe quantos dias avançar (1 a 730).');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(mesRef)) {
      mostrarToast('Selecione o mês de referência.');
      return;
    }

    // Calcular nova data de renovação
    const g = gestaoDe(a);
    const baseDate = g.proximaRenovacao ? new Date(g.proximaRenovacao + 'T00:00:00') : new Date();
    // Se a data base já passou, usa hoje como base
    const hoje = new Date();
    const dataBase = baseDate < hoje ? hoje : baseDate;
    dataBase.setDate(dataBase.getDate() + dias);
    const novaData = dataBase.getFullYear() + '-' + String(dataBase.getMonth() + 1).padStart(2, '0') + '-' + String(dataBase.getDate()).padStart(2, '0');

    // Lê os campos atuais do formulário para não perder nada
    const elTab = document.getElementById('tab-financeiro');
    const dados = {
      nome: a['Nome'],
      telefone: a['Telefone'] || '',
      status: (elTab.querySelector('#fStatus') || {}).value || g.status,
      pagamento: 'Pago',
      plano: (elTab.querySelector('#fPlano') || {}).value || g.plano || '—',
      valor: (elTab.querySelector('#fValor') || {}).value || g.valor,
      proximaRenovacao: novaData,
      arquivado: (elTab.querySelector('#fArquivado') || {}).value || g.arquivado,
      dataNascimento: (elTab.querySelector('#fNascimento') || {}).value || '',
      etiquetas: etiquetasAtuais.join(', '),
      mesReferenciaPagamento: mesRef
    };

    Api.salvarGestaoAluna(dados).then(function () {
      a.gestao = dados;
      // Atualizar histórico em memória
      if (!a.historicoPagamentos) a.historicoPagamentos = [];
      a.historicoPagamentos.unshift({
        'Nome': a['Nome'],
        'Mês/Ano': mesRef,
        'Status': 'Pago',
        'Data do Registro': new Date().toISOString()
      });
      mostrarToast('✓ Plano renovado! Próxima renovação: ' + formatarData(novaData));
      renderTabFinanceiro(a, dados);
      if (typeof renderAlunas === 'function') renderAlunas();
      if (typeof renderDashboard === 'function') renderDashboard();
    });
  });

  // ── LANÇAR MÊS ANTERIOR (retroativo) ──────────────────────────────────────
  document.getElementById('btnLancarMesPago').addEventListener('click', function () {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const sugestao = mesAnterior.getFullYear() + '-' + String(mesAnterior.getMonth() + 1).padStart(2, '0');
    const resposta = prompt(
      'Qual mês/ano lançar como pago? (formato: AAAA-MM, ex: ' + sugestao + ')',
      sugestao
    );
    if (resposta === null) return;
    const mesRef = resposta.trim();
    if (!/^\d{4}-\d{2}$/.test(mesRef)) {
      mostrarToast('Formato inválido. Use AAAA-MM (ex: ' + sugestao + ').');
      return;
    }

    // Verifica se já existe no histórico
    const existente = (a.historicoPagamentos || []).find(function (h) { return String(h['Mês/Ano']) === mesRef; });
    if (existente) {
      mostrarToast('⚠️ ' + mesRef + ' já está no histórico.');
      return;
    }

    // Envia apenas o mês retroativo — sem alterar status, pagamento ou renovação
    const g = gestaoDe(a);
    const elTab = document.getElementById('tab-financeiro');
    const dados = {
      nome: a['Nome'],
      telefone: a['Telefone'] || '',
      status: g.status,
      pagamento: g.pagamento,
      plano: g.plano || '—',
      valor: g.valor,
      proximaRenovacao: g.proximaRenovacao,
      arquivado: g.arquivado,
      dataNascimento: (elTab.querySelector('#fNascimento') || {}).value || '',
      etiquetas: etiquetasAtuais.join(', '),
      mesReferenciaPagamento: mesRef
    };

    Api.salvarGestaoAluna(dados).then(function () {
      if (!a.historicoPagamentos) a.historicoPagamentos = [];
      // Insere na posição correta por data
      a.historicoPagamentos.push({
        'Nome': a['Nome'],
        'Mês/Ano': mesRef,
        'Status': 'Pago',
        'Data do Registro': new Date().toISOString()
      });
      a.historicoPagamentos.sort(function (x, y) {
        return String(y['Mês/Ano']).localeCompare(String(x['Mês/Ano']));
      });
      mostrarToast('✓ ' + mesRef + ' lançado no histórico.');
      renderTabFinanceiro(a, g);
    });
  });

  document.getElementById('btnSalvarFinanceiro').addEventListener('click', function () {
    const el = document.getElementById('tab-financeiro');
    const status = el.querySelector('#fStatus') ? el.querySelector('#fStatus').value : g.status;
    const pagamento = el.querySelector('#fPagamento') ? el.querySelector('#fPagamento').value : g.pagamento;
    const plano = el.querySelector('#fPlano') ? el.querySelector('#fPlano').value : g.plano;
    const valor = el.querySelector('#fValor') ? el.querySelector('#fValor').value : g.valor;
    const proximaRenovacao = el.querySelector('#fRenovacao') ? el.querySelector('#fRenovacao').value : g.proximaRenovacao;
    const arquivado = el.querySelector('#fArquivado') ? el.querySelector('#fArquivado').value : g.arquivado;
    const dataNascimento = el.querySelector('#fNascimento') ? el.querySelector('#fNascimento').value : '';

    const dados = {
      nome: a['Nome'],
      telefone: a['Telefone'] || '',
      status: status,
      pagamento: pagamento,
      plano: plano || '—',
      valor: valor,
      proximaRenovacao: proximaRenovacao,
      arquivado: arquivado,
      dataNascimento: dataNascimento,
      etiquetas: etiquetasAtuais.join(', ')
    };

    // Se o pagamento está sendo marcado como Pago, pergunta o mês de referência
    // para registrar no histórico. Cancela o salvamento se não confirmar.
    if (pagamento === 'Pago' && g.pagamento !== 'Pago') {
      const hoje = new Date();
      const mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
      const resposta = prompt(
        'Qual mês/ano está sendo pago?\n(formato: AAAA-MM, ex: ' + mesAtual + ')',
        mesAtual
      );
      if (resposta === null) return; // usuário cancelou
      const mesRef = resposta.trim();
      if (!/^\d{4}-\d{2}$/.test(mesRef)) {
        mostrarToast('Formato inválido. Use AAAA-MM (ex: ' + mesAtual + ').');
        return;
      }
      dados.mesReferenciaPagamento = mesRef;
    }

    Api.salvarGestaoAluna(dados).then(function () {
      a.gestao = dados;
      a['Data de Nascimento'] = dataNascimento;
      // Adiciona ao histórico em memória para refletir imediatamente sem recarregar
      if (dados.mesReferenciaPagamento) {
        if (!a.historicoPagamentos) a.historicoPagamentos = [];
        a.historicoPagamentos.unshift({
          'Nome': a['Nome'],
          'Mês/Ano': dados.mesReferenciaPagamento,
          'Status': 'Pago',
          'Data do Registro': new Date().toISOString()
        });
        renderTabFinanceiro(a, dados);
      }
      mostrarToast('✓ Dados de ' + (a['Nome'].split(' ')[0]) + ' salvos!');
      // Atualiza a lista em segundo plano sem fechar o modal
      if (typeof renderAlunas === 'function') renderAlunas();
      if (typeof renderDashboard === 'function') renderDashboard();
    });
  });

  document.getElementById('btnExcluirAluna').addEventListener('click', function () {
    const ok = confirm('Excluir "' + a['Nome'] + '" definitivamente? Isso remove a ficha, check-ins e fotos. Não pode ser desfeito.\n\nPrefere só esconder sem apagar? Use "Arquivada" em vez disso.');
    if (!ok) return;
    Api.excluirAluna(a['Nome']).then(function () {
      ALUNAS = ALUNAS.filter(function (x) { return x !== a; });
      document.getElementById('modalAluna').classList.remove('show');
      mostrarToast('Aluna excluída.');
      renderAlunas();
    });
  });
}


/* ============================================================
   RELATÓRIO PDF — montado na aba do perfil da aluna e impresso
   via window.print() com CSS @media print dedicado.
   ============================================================ */
function renderTabRelatorio(a) {
  var el = document.getElementById('tab-relatorio');
  var g = gestaoDe(a);
  var nome = a['Nome'] || '—';
  var hoje = new Date().toLocaleDateString('pt-BR');

  // ── Dados físicos (último check-in com peso + evolução) ──
  var checkinsComPeso = (a.checkins || []).filter(function (c) { return c['Peso']; })
    .slice().sort(function (x, y) { return new Date(x['Data/Hora']) - new Date(y['Data/Hora']); });
  var ultimoPeso = checkinsComPeso.length ? checkinsComPeso[checkinsComPeso.length - 1] : null;
  var primeiroPeso = checkinsComPeso.length ? checkinsComPeso[0] : null;

  var pesoNum = ultimoPeso ? parseFloat(ultimoPeso['Peso']) : null;
  var pesoAnteriorNum = (checkinsComPeso.length > 1) ? parseFloat(checkinsComPeso[checkinsComPeso.length - 2]['Peso']) : null;
  var alturaNum = parseFloat(a['Altura (cm)']);
  if (alturaNum && alturaNum < 3) alturaNum = alturaNum * 100;

  function deltaCor(dif, inverso) {
    if (dif === null) return '';
    var bom = inverso ? dif > 0 : dif < 0;
    return bom ? 'positivo' : 'negativo';
  }
  function deltaHtml(atual, anterior, unidade, inverso) {
    if (atual === null || anterior === null) return '';
    var dif = (atual - anterior).toFixed(1);
    var sinal = dif > 0 ? '+' : '';
    return '<div class="rel-delta ' + deltaCor(dif, inverso) + '">' + sinal + dif + ' ' + unidade + ' desde anterior</div>';
  }

  // IMC
  var imcTxt = '—';
  if (pesoNum && alturaNum) {
    var imc = pesoNum / Math.pow(alturaNum / 100, 2);
    var classe = imc < 18.5 ? 'Abaixo do peso' : imc < 25 ? 'Peso normal' : imc < 30 ? 'Sobrepeso' : 'Obesidade';
    imcTxt = imc.toFixed(1) + ' (' + classe + ')';
  }

  // Variação total de peso
  var variacaoPeso = '';
  if (primeiroPeso && ultimoPeso && primeiroPeso !== ultimoPeso) {
    var dif = (parseFloat(ultimoPeso['Peso']) - parseFloat(primeiroPeso['Peso'])).toFixed(1);
    var sinal = dif > 0 ? '+' : '';
    variacaoPeso = sinal + dif + ' kg desde o início (' + formatarData(primeiroPeso['Data/Hora']) + ')';
  }

  // Fotos (mais antigas e mais recentes)
  var fotosLista = mesclarFotosPorDia(a.fotos || []).sort(function (x, y) { return new Date(x['Data/Hora']) - new Date(y['Data/Hora']); });
  var fotoInicial = fotosLista.length ? fotosLista[0] : null;
  var fotoAtual = fotosLista.length > 1 ? fotosLista[fotosLista.length - 1] : null;

  // Últimos 5 check-ins
  var ultCheckins = (a.checkins || []).slice().sort(function (x, y) { return new Date(y['Data/Hora']) - new Date(x['Data/Hora']); }).slice(0, 5);

  // Notas pessoais
  var notas = g.notas || '';

  // ── Montar HTML da aba ──
  var html = '';

  // Botão imprimir (visível na tela, oculto na impressão)
  html += '<div class="no-print-btn" style="margin-bottom:1rem;">' +
    '<button class="btn btn-primary" id="btnImprimirRelatorio">🖨️ Imprimir / Salvar PDF</button>' +
    '<span style="font-size:.8rem; color:var(--ink-soft); margin-left:.8rem;">Use "Salvar como PDF" na janela de impressão.</span>' +
  '</div>';

  // Preview do relatório (mesmo layout do que será impresso)
  html += '<div id="preview-relatorio-interno" style="background:#fff; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; font-family:Georgia,serif;">';

  // Cabeçalho
  html += '<div style="background:#7C1B2A; color:#fff; padding:20px 24px; display:flex; justify-content:space-between; align-items:flex-end;">' +
    '<div><div style="font-size:12px; opacity:.7; letter-spacing:.06em; text-transform:uppercase; margin-bottom:4px;">Consultoria Cássia Rodrigues</div>' +
    '<div style="font-size:20px; font-weight:700;">' + nome + '</div></div>' +
    '<div style="text-align:right; font-size:11px; opacity:.8;">' +
      '<div style="text-transform:uppercase; letter-spacing:.06em;">Relatório de Evolução</div>' +
      '<div style="margin-top:3px;">Emitido em ' + hoje + '</div>' +
    '</div>' +
  '</div>';

  // Corpo
  html += '<div style="padding:20px 24px;">';

  // Dados do plano
  html += '<div style="margin-bottom:16px; padding:14px 18px; border:1px solid #e0dbd6; border-radius:8px;">' +
    '<div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#7C1B2A; margin-bottom:10px;">Plano & Objetivo</div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">' +
      '<div><div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Plano</div><div style="font-weight:600;">' + (g.plano && g.plano !== '—' ? g.plano : '—') + '</div></div>' +
      '<div><div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Status</div><div style="font-weight:600;">' + (g.status || '—') + '</div></div>' +
      '<div><div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Objetivo</div><div style="font-weight:600; font-size:.88rem;">' + (a['Objetivo Principal'] || '—') + '</div></div>' +
    '</div>' +
  '</div>';

  // Dados físicos
  html += '<div style="margin-bottom:16px; padding:14px 18px; border:1px solid #e0dbd6; border-radius:8px;">' +
    '<div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#7C1B2A; margin-bottom:10px;">Composição Física Atual</div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">' +
      '<div><div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Peso</div>' +
        '<div style="font-size:17px; font-weight:700;">' + (pesoNum ? pesoNum + ' kg' : '—') + '</div>' +
        (pesoNum && pesoAnteriorNum ? deltaHtml(pesoNum, pesoAnteriorNum, 'kg', false) : '') +
      '</div>' +
      '<div><div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Altura</div>' +
        '<div style="font-size:17px; font-weight:700;">' + (alturaNum ? alturaNum + ' cm' : '—') + '</div>' +
      '</div>' +
      '<div><div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">IMC</div>' +
        '<div style="font-size:14px; font-weight:700;">' + imcTxt + '</div>' +
      '</div>' +
    '</div>' +
    (variacaoPeso ? '<div style="margin-top:10px; font-size:.82rem; color:#7C1B2A; font-style:italic;">📈 ' + variacaoPeso + '</div>' : '') +
  '</div>';

  // Fotos antes/depois
  if (fotoInicial || fotoAtual) {
    html += '<div style="margin-bottom:16px; padding:14px 18px; border:1px solid #e0dbd6; border-radius:8px;">' +
      '<div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#7C1B2A; margin-bottom:10px;">Fotos de Progresso</div>' +
      '<div style="display:flex; gap:20px; flex-wrap:wrap;">';

    function blocoFoto(foto, rotulo) {
      if (!foto) return '';
      var poses = [['Foto Frente','Frente'],['Foto Perfil','Perfil'],['Foto Costas','Costas']];
      var imgs = '';
      poses.forEach(function (p) {
        var thumb = miniaturaDrive(foto[p[0]]);
        if (!thumb) return;
        imgs += '<div style="text-align:center;">' +
          '<img src="' + thumb + '" style="width:100px; height:130px; object-fit:cover; border-radius:6px; border:1px solid #e0dbd6;" loading="lazy">' +
          '<div style="font-size:9px; color:#888; margin-top:3px;">' + p[1] + '</div>' +
        '</div>';
      });
      if (!imgs) return '';
      return '<div>' +
        '<div style="font-size:11px; font-weight:600; color:#555; margin-bottom:8px;">' + rotulo + ' · ' + formatarData(foto['Data/Hora']) + '</div>' +
        '<div style="display:flex; gap:8px;">' + imgs + '</div>' +
      '</div>';
    }

    html += blocoFoto(fotoInicial, 'Início');
    if (fotoAtual) html += blocoFoto(fotoAtual, 'Atual');
    html += '</div></div>';
  }

  // Últimos check-ins
  if (ultCheckins.length) {
    var emojiHumor = { 'Animada': '😊', 'Tranquila': '🙂', 'Cansada': '😮', 'Estressada': '😣', 'Desanimada': '😔' };
    html += '<div style="margin-bottom:16px; padding:14px 18px; border:1px solid #e0dbd6; border-radius:8px;">' +
      '<div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#7C1B2A; margin-bottom:10px;">Últimos Check-ins</div>' +
      '<table style="width:100%; border-collapse:collapse; font-size:12px;">' +
      '<thead><tr>' +
        '<th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e0dbd6; font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.04em;">Data</th>' +
        '<th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e0dbd6; font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.04em;">Peso</th>' +
        '<th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e0dbd6; font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.04em;">Energia</th>' +
        '<th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e0dbd6; font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.04em;">Humor</th>' +
        '<th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e0dbd6; font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.04em;">Observação</th>' +
      '</tr></thead><tbody>';
    ultCheckins.forEach(function (c) {
      html += '<tr>' +
        '<td style="padding:5px 6px; border-bottom:1px solid #f0ece8;">' + formatarData(c['Data/Hora']) + '</td>' +
        '<td style="padding:5px 6px; border-bottom:1px solid #f0ece8;">' + (c['Peso'] ? c['Peso'] + ' kg' : '—') + '</td>' +
        '<td style="padding:5px 6px; border-bottom:1px solid #f0ece8;">' + (c['Energia'] != null ? c['Energia'] + '/10' : '—') + '</td>' +
        '<td style="padding:5px 6px; border-bottom:1px solid #f0ece8;">' + (c['Humor'] ? (emojiHumor[c['Humor']] || '') + ' ' + c['Humor'] : '—') + '</td>' +
        '<td style="padding:5px 6px; border-bottom:1px solid #f0ece8; font-size:11px;">' + (c['Observação'] || '—') + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // Observações pessoais (notas)
  if (notas) {
    html += '<div style="margin-bottom:16px; padding:14px 18px; border:1px solid #e0dbd6; border-radius:8px;">' +
      '<div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#7C1B2A; margin-bottom:8px;">Observações</div>' +
      '<div style="font-size:13px; line-height:1.6; white-space:pre-wrap;">' + notas + '</div>' +
    '</div>';
  }

  // Rodapé
  html += '<div style="margin-top:24px; text-align:center; font-size:10px; color:#aaa; border-top:1px solid #e0dbd6; padding-top:12px;">' +
    'Consultoria Cássia Rodrigues · CREF 020444-G/PA · cassiarodriguespersonal@gmail.com' +
  '</div>';

  html += '</div></div>'; // fecha padding + card

  el.innerHTML = html;

  // Evento do botão imprimir
  var btnImprimir = document.getElementById('btnImprimirRelatorio');
  if (btnImprimir) {
    btnImprimir.addEventListener('click', function () {
      // Copia o HTML do preview para o div de impressão e chama print()
      var root = document.getElementById('print-relatorio-root');
      root.innerHTML = document.getElementById('preview-relatorio-interno').innerHTML;
      window.print();
      // Limpa após impressão
      setTimeout(function () { root.innerHTML = ''; }, 1000);
    });
  }
}

function renderTabAcoes(a) {
  const el = document.getElementById('tab-acoes');
  const whats = telefoneParaWhats(a['Telefone']);
  const nome = a['Nome'] || '';

  function botaoWhats(label, textoBruto) {
    const texto = textoBruto.replace(/\{nome\}/g, primeiroNome(nome));
    return '<a class="btn btn-sm" target="_blank" href="https://wa.me/' + whats + '?text=' + encodeURIComponent(texto) + '">' + label + '</a>';
  }
  function botaoEmail(label, assunto, corpoBruto) {
    const corpo = corpoBruto.replace(/\{nome\}/g, nome);
    return '<a class="btn btn-sm" href="mailto:' + (a['E-mail'] || '') + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo) + '">' + label + '</a>';
  }

  let html = blocoContrato(a) + '<h3 style="font-size:.95rem; margin-bottom:.7rem;">WhatsApp</h3><div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.4rem;">';
  if (!whats) {
    html += '<p style="color:var(--ink-soft);">Esta aluna não tem telefone cadastrado.</p>';
  } else {
    html += botaoWhats('Boas-vindas', CONFIG.modelosWhatsapp.boasVindas);
    html += botaoWhats('Lembrete semanal', CONFIG.modelosWhatsapp.lembreteSemanal + linkCheckinPara(nome));
    // Check-in com tipo pré-selecionado — mensal e trimestral incluem pedido de fotos na mesma mensagem
    html += '<div style="width:100%; display:flex; align-items:center; gap:.5rem; margin:.3rem 0 .1rem; flex-wrap:wrap;">' +
      '<span style="font-size:.75rem; color:var(--ink-faint); white-space:nowrap;">Check-in:</span>' +
      botaoWhats('📅 Semanal', CONFIG.modelosWhatsapp.solicitarCheckin + linkCheckinPara(nome) + '&tipo=' + encodeURIComponent('Semanal')) +
      botaoWhats('🗓️ Mensal', CONFIG.modelosWhatsapp.solicitarCheckin + linkCheckinPara(nome) + '&tipo=' + encodeURIComponent('Mensal') + '\n\nE para completar sua avaliação mensal, atualize também suas fotos de progresso: ' + CONFIG.linkGuiaFotos + '?nome=' + encodeURIComponent(nome)) +
      botaoWhats('📆 Trimestral', CONFIG.modelosWhatsapp.solicitarCheckin + linkCheckinPara(nome) + '&tipo=' + encodeURIComponent('Trimestral') + '\n\nE para completar sua avaliação trimestral, atualize também suas fotos de progresso: ' + CONFIG.linkGuiaFotos + '?nome=' + encodeURIComponent(nome)) +
    '</div>';
    html += botaoWhats('Pedir fotos', CONFIG.modelosWhatsapp.solicitarFotos + CONFIG.linkGuiaFotos);
    html += botaoWhats('Lembrete de pagamento', CONFIG.modelosWhatsapp.lembretePagamento);
    html += botaoWhats('Motivação', CONFIG.modelosWhatsapp.motivacao);
    html += '</div>';
  }

  html += '<h3 style="font-size:.95rem; margin-bottom:.7rem;">E-mail</h3><div style="display:flex; gap:.5rem; flex-wrap:wrap;">';
  if (!a['E-mail']) {
    html += '<p style="color:var(--ink-soft);">Esta aluna não tem e-mail cadastrado.</p>';
  } else {
    const m = CONFIG.modelosEmail;
    html += botaoEmail('Boas-vindas', m.boasVindas.assunto, m.boasVindas.corpo);
    html += botaoEmail('Lembrete semanal', m.lembreteSemanal.assunto, m.lembreteSemanal.corpo);
    html += botaoEmail('Pedir fotos', m.solicitarFotos.assunto, m.solicitarFotos.corpo);
    html += botaoEmail('Renovação', m.renovacao.assunto, m.renovacao.corpo);
  }
  html += '</div>';

  el.innerHTML = html;
}

/* ============================================================
   CHECK-INS (visão global)
   ============================================================ */
function renderCheckins() {
  const filtroTipo = document.getElementById('filtroTipoCheckin').value;
  const todos = [];
  ALUNAS.forEach(function (a) {
    (a.checkins || []).forEach(function (c) {
      todos.push(Object.assign({ _nome: a['Nome'] }, c));
    });
  });
  todos.sort(function (x, y) { return new Date(y['Data/Hora']) - new Date(x['Data/Hora']); });

  const contagem = { Semanal: 0, Mensal: 0, Trimestral: 0 };
  todos.forEach(function (c) { contagem[c['Tipo'] || 'Semanal'] = (contagem[c['Tipo'] || 'Semanal'] || 0) + 1; });
  document.getElementById('checkinsStatsTipo').innerHTML =
    '<div class="stat-card"><div class="num">' + contagem.Semanal + '</div><div class="lbl">📅 Semanais</div></div>' +
    '<div class="stat-card"><div class="num">' + contagem.Mensal + '</div><div class="lbl">🗓️ Mensais</div></div>' +
    '<div class="stat-card"><div class="num">' + contagem.Trimestral + '</div><div class="lbl">📆 Trimestrais</div></div>';

  const filtrados = filtroTipo === 'todos' ? todos : todos.filter(function (c) { return (c['Tipo'] || 'Semanal') === filtroTipo; });

  const corpo = document.querySelector('#tabelaCheckins tbody');
  corpo.innerHTML = filtrados.length ? filtrados.slice(0, 100).map(function (c) {
    return '<tr><td>' + formatarDataHora(c['Data/Hora']) + '</td><td>' + c._nome + '</td><td>' + (c['Tipo'] || 'Semanal') + '</td><td>' + (c['Peso'] || '—') + '</td><td>' + (c['Semana'] || '—') + '</td><td>' + (c['Energia'] ?? '—') + '/10</td><td>' + (c['Dor'] === 'Sim' ? '⚠ ' + (c['Onde a Dor'] || 'sim') : 'Não') + '</td></tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center; color:var(--ink-soft);">Nenhum check-in registrado ainda.</td></tr>';
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('filtroTipoCheckin').addEventListener('change', renderCheckins);
});

/* ============================================================
   ENVIAR CHECK-IN PARA UMA ALUNA (Semanal / Mensal / Trimestral)
   ============================================================ */
function renderEnvioCheckin() {
  const selNome = document.getElementById('checkinNome');
  selNome.innerHTML = alunasVisiveis().map(function (a) {
    return '<option value="' + a['Nome'] + '">' + a['Nome'] + '</option>';
  }).join('') || '<option value="">Nenhuma aluna cadastrada</option>';

  document.getElementById('btnEnviarCheckinFerramenta').onclick = function () {
    const nome = selNome.value;
    const aluna = ALUNAS.find(function (a) { return a['Nome'] === nome; });
    if (!aluna) { mostrarToast('Selecione uma aluna.'); return; }

    const tipo = document.getElementById('checkinTipo').value;
    const canal = document.getElementById('checkinCanal').value;
    const link = linkCheckinPara(nome) + '&tipo=' + encodeURIComponent(tipo);
    const textoBase = (CONFIG.modelosWhatsapp.apresentarCheckin || 'Está na hora do seu check-in: ').replace(/\{nome\}/g, primeiroNome(nome));

    if (canal === 'whatsapp') {
      const whats = telefoneParaWhats(aluna['Telefone']);
      if (!whats) { mostrarToast('Essa aluna não tem telefone cadastrado.'); return; }
      window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(textoBase + link), '_blank');
    } else {
      if (!aluna['E-mail']) { mostrarToast('Essa aluna não tem e-mail cadastrado.'); return; }
      window.location.href = 'mailto:' + aluna['E-mail'] + '?subject=' + encodeURIComponent('Check-in ' + tipo) + '&body=' + encodeURIComponent(textoBase + link);
    }
  };
}

/* ============================================================
   FINANCEIRO
   ============================================================ */
function renderFinanceiro() {
  const visiveis = alunasVisiveis();
  const devendo = visiveis.filter(function (a) { return gestaoDe(a).pagamento === 'Devendo'; });
  const somaDevendo = devendo.reduce(function (s, a) { return s + (parseFloat(gestaoDe(a).valor) || 0); }, 0);
  const renovam7 = visiveis.filter(function (a) { const d = diasAte(gestaoDe(a).proximaRenovacao); return d !== null && d >= 0 && d <= 7; }).length;

  document.getElementById('financeiroStats').innerHTML = [
    ['Alunas devendo', devendo.length],
    ['Total a receber', 'R$ ' + somaDevendo.toFixed(2)],
    ['Renovações em 7 dias', renovam7]
  ].map(function (s) { return '<div class="stat-card"><div class="num">' + s[1] + '</div><div class="lbl">' + s[0] + '</div></div>'; }).join('');

  const corpo = document.querySelector('#tabelaFinanceiro tbody');
  corpo.innerHTML = visiveis.map(function (a, indice) {
    const g = gestaoDe(a);
    return '<tr>' +
      '<td>' + a['Nome'] + '</td>' +
      '<td><span class="badge ' + (g.status === 'Inativo' ? 'badge-inativo' : 'badge-ativo') + '">' + g.status + '</span></td>' +
      '<td><span class="badge ' + (g.pagamento === 'Devendo' ? 'badge-devendo' : 'badge-pago') + '">' + g.pagamento + '</span></td>' +
      '<td>' + g.plano + '</td>' +
      '<td>' + (g.valor ? 'R$ ' + g.valor : '—') + '</td>' +
      '<td>' + (g.proximaRenovacao ? formatarData(g.proximaRenovacao) : '—') + '</td>' +
      '<td><button class="btn btn-sm" data-ver-financeiro="' + indice + '">Ver / editar</button></td>' +
    '</tr>';
  }).join('');

  corpo.querySelectorAll('[data-ver-financeiro]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      abrirModalAluna(visiveis[parseInt(btn.getAttribute('data-ver-financeiro'), 10)]);
      document.querySelector('.modal-tab[data-tab="financeiro"]').click();
    });
  });
}

/* ============================================================
   MODELOS DE E-MAIL E WHATSAPP
   ============================================================ */
const ROTULOS_MODELOS_UNIFICADOS = { boasVindas: 'Boas-vindas', lembreteSemanal: 'Lembrete semanal', solicitarCheckin: 'Solicitação de check-in', solicitarFotos: 'Solicitação de fotos', solicitarReavaliacao: 'Solicitação de reavaliação', lembretePagamento: 'Lembrete de pagamento', motivacao: 'Motivação', renovacao: 'Renovação da consultoria' };

function renderModelosUnificados() {
  const el = document.getElementById('listaModelosUnificados');
  el.innerHTML = Object.keys(ROTULOS_MODELOS_UNIFICADOS).map(function (k) {
    const temWhats = CONFIG.modelosWhatsapp[k] !== undefined;
    const temEmail = CONFIG.modelosEmail[k] !== undefined;
    let html = '<div class="template-card"><div class="tit">' + ROTULOS_MODELOS_UNIFICADOS[k] + '</div>';
    if (temWhats) {
      html += '<div class="form-field"><label>💬 Texto WhatsApp</label><textarea data-modelo-whats="' + k + '">' + CONFIG.modelosWhatsapp[k] + '</textarea></div>';
    }
    if (temEmail) {
      const m = CONFIG.modelosEmail[k];
      html += '<div class="form-field"><label>✉️ Assunto do e-mail</label><input type="text" data-modelo-email-assunto="' + k + '" value="' + m.assunto.replace(/"/g, '&quot;') + '"></div>' +
        '<div class="form-field"><label>✉️ Corpo do e-mail</label><textarea data-modelo-email-corpo="' + k + '">' + m.corpo + '</textarea></div>';
    }
    html += '</div>';
    return html;
  }).join('');

  document.getElementById('btnSalvarModelosUnificados').onclick = function () {
    Object.keys(ROTULOS_MODELOS_UNIFICADOS).forEach(function (k) {
      const campoWhats = document.querySelector('[data-modelo-whats="' + k + '"]');
      if (campoWhats) CONFIG.modelosWhatsapp[k] = campoWhats.value;
      const campoAssunto = document.querySelector('[data-modelo-email-assunto="' + k + '"]');
      const campoCorpo = document.querySelector('[data-modelo-email-corpo="' + k + '"]');
      if (campoAssunto && campoCorpo) {
        CONFIG.modelosEmail[k].assunto = campoAssunto.value;
        CONFIG.modelosEmail[k].corpo = campoCorpo.value;
      }
    });
    salvarConfig(CONFIG);
    mostrarToast('Modelos salvos!');
  };

  document.getElementById('btnMeuWhatsapp').onclick = function () {
    const texto = 'Oi! Aqui é a ' + CONFIG.meuNome + ', meu WhatsApp para falarmos sobre sua consultoria.';
    window.open('https://wa.me/' + CONFIG.meuWhatsapp + '?text=' + encodeURIComponent(texto), '_blank');
  };
}

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */
function preencherFormularioConfig() {
  document.getElementById('cfgScriptUrl').value = CONFIG.googleScriptUrl;
  document.getElementById('cfgMeuNome').value = CONFIG.meuNome;
  document.getElementById('cfgMeuWhatsapp').value = CONFIG.meuWhatsapp;
  document.getElementById('cfgMeuEmail').value = CONFIG.meuEmail;
  document.getElementById('cfgLinkFicha').value = CONFIG.linkFicha;
  document.getElementById('cfgLinkGuiaFotos').value = CONFIG.linkGuiaFotos;
  document.getElementById('cfgLinkCheckin').value = CONFIG.linkCheckin;
  document.getElementById('cfgLinkContrato').value = CONFIG.linkContrato;
  document.getElementById('cfgDiasCheckin').value = CONFIG.diasAlertaCheckin;
  document.getElementById('cfgDiasFotos').value = CONFIG.diasAlertaFotos;
  document.getElementById('cfgDiasReavaliacao').value = CONFIG.diasAlertaReavaliacao;

  document.getElementById('btnSalvarConfig').addEventListener('click', function () {
    CONFIG.googleScriptUrl = document.getElementById('cfgScriptUrl').value.trim();
    CONFIG.meuNome = document.getElementById('cfgMeuNome').value.trim();
    CONFIG.meuWhatsapp = document.getElementById('cfgMeuWhatsapp').value.trim();
    CONFIG.meuEmail = document.getElementById('cfgMeuEmail').value.trim();
    CONFIG.linkFicha = document.getElementById('cfgLinkFicha').value.trim();
    CONFIG.linkGuiaFotos = document.getElementById('cfgLinkGuiaFotos').value.trim();
    CONFIG.linkCheckin = document.getElementById('cfgLinkCheckin').value.trim();
    CONFIG.linkContrato = document.getElementById('cfgLinkContrato').value.trim();
    CONFIG.diasAlertaCheckin = parseInt(document.getElementById('cfgDiasCheckin').value) || 7;
    CONFIG.diasAlertaFotos = parseInt(document.getElementById('cfgDiasFotos').value) || 30;
    CONFIG.diasAlertaReavaliacao = parseInt(document.getElementById('cfgDiasReavaliacao').value) || 45;
    salvarConfig(CONFIG);
    mostrarToast('Configurações salvas!');
    carregarDados();
  });

  document.getElementById('btnBackupAgora').addEventListener('click', function () {
    const btn = document.getElementById('btnBackupAgora');
    btn.disabled = true;
    btn.textContent = 'Pedindo backup...';
    Api.enviarAcao({ tipo: 'backup_manual' }).then(function () {
      mostrarToast('Backup solicitado. Confira a pasta "Backups - Consultoria Cássia" no seu Drive em alguns instantes.');
      btn.disabled = false;
      btn.textContent = '💾 Fazer backup agora';
    });
  });

  document.getElementById('btnBackupFotosAgora').addEventListener('click', function () {
    const btn = document.getElementById('btnBackupFotosAgora');
    btn.disabled = true;
    btn.textContent = 'Copiando fotos...';
    mostrarToast('Isso pode levar mais tempo que o backup da planilha, dependendo de quantas fotos você já tem.');
    Api.enviarAcao({ tipo: 'backup_fotos_manual' }).then(function () {
      mostrarToast('Backup das fotos solicitado. Confira a pasta "Backups - Consultoria Cássia" no seu Drive em alguns minutos.');
      btn.disabled = false;
      btn.textContent = '🖼️ Fazer backup das fotos agora';
    });
  });
}

/* ============================================================
   CADASTRAR ALUNA ANTIGA
   ============================================================ */
function ligarModalNovaAluna() {
  document.getElementById('btnNovaAluna').addEventListener('click', function () {
    document.getElementById('modalNovaAluna').classList.add('show');
  });
  document.getElementById('btnFecharModalNova').addEventListener('click', function () {
    document.getElementById('modalNovaAluna').classList.remove('show');
  });
  document.getElementById('btnSalvarNovaAluna').addEventListener('click', function () {
    const nome = formatarNomeProprio(document.getElementById('novaAlunaNome').value.trim());
    if (!nome) { mostrarToast('Informe o nome da aluna.'); return; }
    const telefone = document.getElementById('novaAlunaTelefone').value.trim();
    const enviarContrato = document.getElementById('novaAlunaEnviarContrato').checked;

    const dados = {
      nome: nome,
      telefone: telefone,
      status: 'Ativo',
      pagamento: 'Pago',
      plano: document.getElementById('novaAlunaPlano').value.trim() || '—',
      valor: document.getElementById('novaAlunaValor').value,
      proximaRenovacao: '',
      arquivado: 'Não'
    };

    const btn = document.getElementById('btnSalvarNovaAluna');
    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    Api.salvarGestaoAluna(dados).then(function () {
      mostrarToast('Cadastrando... confirmando o ID.');

      // Dá um tempinho pro Apps Script terminar de gravar, depois busca os
      // dados atualizados de verdade (mesmo caminho já confiável da
      // atualização normal do painel) pra achar o ID que acabou de nascer.
      setTimeout(function () {
        Api.buscarAlunas(true).then(function (lista) {
          ALUNAS = lista;
          const telefoneAlvo = telefoneParaWhats(telefone);
          const criada = lista.filter(function (a) {
            return telefoneAlvo && telefoneParaWhats(a['Telefone'] || '') === telefoneAlvo;
          })[0];

          btn.disabled = false;
          btn.textContent = 'Cadastrar';
          document.getElementById('modalNovaAluna').classList.remove('show');
          ['novaAlunaNome', 'novaAlunaTelefone', 'novaAlunaPlano', 'novaAlunaValor'].forEach(function (id) { document.getElementById(id).value = ''; });

          const secaoAtiva = document.querySelector('.section.active');
          if (secaoAtiva) mostrarSecao(secaoAtiva.id.replace('section-', ''));

          if (!criada || !criada['ID']) {
            mostrarToast('Cadastrado, mas não consegui confirmar o ID ainda. Atualize a lista em alguns segundos.');
            return;
          }

          mostrarToast('Aluna cadastrada! ID ' + criada['ID']);

          if (enviarContrato && telefoneAlvo) {
            const separador = CONFIG.linkContrato.indexOf('?') === -1 ? '?' : '&';
            const linkContratoAluna = CONFIG.linkContrato + separador + 'nome=' + encodeURIComponent(criada['Nome'] || nome);
            const msg = 'Oi, ' + primeiroNome(criada['Nome'] || nome) + '! Que bom ter você como aluna 💪 Antes de começarmos, preciso que você leia e aceite o contrato: ' + linkContratoAluna;
            Api.enviarAcao({ tipo: 'gerar_contrato', nome: criada['Nome'] || nome }).then(function () {
              window.open('https://wa.me/' + telefoneAlvo + '?text=' + encodeURIComponent(msg), '_blank');
            });
          }
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = 'Cadastrar';
          mostrarToast('Cadastro enviado, mas não consegui confirmar agora. Atualize a lista pra conferir.');
        });
      }, 1800);
    });
  });
}

/* ============================================================
   INSTALAÇÃO DO APP (PWA)
   ============================================================ */
let eventoInstalacaoAdiado = null;

window.addEventListener('beforeinstallprompt', function (evento) {
  evento.preventDefault();
  eventoInstalacaoAdiado = evento;
  const btn = document.getElementById('btnInstalarApp');
  if (btn) btn.style.display = 'inline-block';
});

document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('btnInstalarApp');
  const instrucao = document.getElementById('instrucaoInstalarManual');
  if (!btn || !instrucao) return;

  const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const jaInstalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  if (jaInstalado) {
    instrucao.style.display = 'block';
    instrucao.innerHTML = '✓ Você já está usando o app instalado.';
  } else if (ehIOS) {
    instrucao.style.display = 'block';
    instrucao.innerHTML = 'No iPhone ou iPad: toque no ícone de compartilhar (□ com uma seta para cima) na barra do Safari, depois em "Adicionar à Tela de Início".';
  }

  btn.addEventListener('click', function () {
    if (!eventoInstalacaoAdiado) return;
    eventoInstalacaoAdiado.prompt();
    eventoInstalacaoAdiado.userChoice.then(function () {
      eventoInstalacaoAdiado = null;
      btn.style.display = 'none';
    });
  });
});
