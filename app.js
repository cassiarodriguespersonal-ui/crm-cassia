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
  return aluna.gestao || { status: 'Ativo', pagamento: 'Pago', plano: '—', valor: '', proximaRenovacao: '', arquivado: 'Não' };
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

  let nivel = 'baixo';
  if (urgente) nivel = 'alto';
  else if (sinais.length) nivel = 'medio';

  return { sinais: sinais, urgente: urgente, nivel: nivel, diasCheckin: diasCheckin === null ? 9999 : diasCheckin };
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
  const reavaliacoesProximas = visiveis.filter(function (a) {
    const dias = diasAte(gestaoDe(a).proximaRenovacao);
    return dias !== null && dias >= 0 && dias <= 7;
  }).length;

  // ---- Quem precisa de carinho (calculado cedo para alimentar os cartões também) ----
  const candidatas = [];
  visiveis.forEach(function (a) {
    const r = calcularRisco(a);
    if (r.sinais.length) {
      candidatas.push({ nome: a['Nome'], telefone: a['Telefone'], sinais: r.sinais, urgente: r.urgente, diasCheckin: r.diasCheckin });
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
    [total, 'Total de alunas'],
    [ativas, 'Alunas ativas'],
    [emRisco, 'Alunas em risco'],
    [adesao === null ? '—' : adesao + '%', 'Adesão aos check-ins'],
    [checkinsPendentes, 'Check-ins pendentes'],
    [reavaliacoesProximas, 'Reavaliações da semana']
  ].map(function (s) {
    return '<div class="stat-card"><div class="num">' + s[0] + '</div><div class="lbl">' + s[1] + '</div></div>';
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
      aniversariantes.push({ nome: a['Nome'], telefone: a['Telefone'], dias: prox.dias, ehHoje: prox.ehHoje });
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
        '<div class="acao">' + (whats ? '<button class="btn btn-sm btn-accent" data-parabens="' + indice + '">🎂 Parabenizar</button>' : '') + '</div>' +
      '</div>';
    }).join('');
    document.querySelectorAll('[data-parabens]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const av = aniversariantes[parseInt(btn.getAttribute('data-parabens'), 10)];
        const whats = telefoneParaWhats(av.telefone);
        const texto = 'Parabéns, ' + primeiroNome(av.nome) + '! 🎉🎂 Desejo um ano incrível, cheio de saúde e conquistas. Conte comigo!';
        window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
      });
    });
  } else {
    painelAniv.style.display = 'none';
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
      return '<div class="care-card' + (c.urgente ? ' urgente' : '') + '">' +
        '<div class="info">' +
          '<div class="nome">' + c.nome + '</div>' +
          '<div class="sinais">' + c.sinais.map(function (s) { return '<span class="care-chip' + (s.risco ? ' risco' : '') + '">' + s.texto + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="acao">' + (whats ? '<button class="btn btn-sm btn-accent" data-mensagem-cuidado="' + indice + '">💬 Mensagem</button>' : '') + '</div>' +
      '</div>';
    }).join('');

    document.querySelectorAll('[data-mensagem-cuidado]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const c = candidatas[parseInt(btn.getAttribute('data-mensagem-cuidado'), 10)];
        const whats = telefoneParaWhats(c.telefone);
        const texto = (CONFIG.modelosWhatsapp.motivacao || 'Oi, {nome}! Tudo bem? Senti sua falta por aqui. 💪').replace(/\{nome\}/g, primeiroNome(c.nome));
        window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
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
          '<span style="' + (feita ? 'text-decoration:line-through;' : '') + '">' + t.icone + ' ' + t.texto + '</span>' +
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
  document.getElementById('textoApresentarFicha').value = CONFIG.modelosWhatsapp.apresentarFicha || '';
  document.getElementById('textoApresentarFotos').value = CONFIG.modelosWhatsapp.apresentarGuiaFotos || '';
}

const ROTULOS_MODELO_WHATS = { boasVindas: 'Boas-vindas', lembreteSemanal: 'Lembrete semanal', solicitarCheckin: 'Pedir check-in', solicitarFotos: 'Pedir fotos', lembretePagamento: 'Lembrete de pagamento', motivacao: 'Motivação' };
const ROTULOS_MODELO_EMAIL = { boasVindas: 'Boas-vindas', lembreteSemanal: 'Lembrete semanal', solicitarFotos: 'Pedir fotos', renovacao: 'Renovação' };

function renderEnvioFerramenta() {
  const listaEl = document.getElementById('ferramentaListaAlunas');
  const visiveis = alunasVisiveis();

  listaEl.innerHTML = visiveis.length ? visiveis.map(function (a, i) {
    return '<label style="display:flex; align-items:center; gap:.6rem; padding:.4rem 0; border-bottom:1px solid var(--line-soft); font-size:.86rem; cursor:pointer;">' +
      '<input type="checkbox" class="ferramenta-check-aluna" value="' + i + '"> ' + a['Nome'] +
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
          if (chave === 'solicitarCheckin') texto += CONFIG.linkCheckin;
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
        if (r.modelo === 'lembreteSemanal') texto += CONFIG.linkCheckin;
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
});

/* ============================================================
   GESTÃO DE ALUNAS
   ============================================================ */
function renderAlunas() {
  const termo = document.getElementById('buscaAluna').value.trim().toLowerCase();
  const ordem = document.getElementById('ordenarAluna').value;
  const statusFiltro = document.getElementById('filtroStatusAluna').value;
  const mostrarArquivadas = document.getElementById('mostrarArquivadasAluna').checked;

  let filtradas = ALUNAS.filter(function (a) {
    const g = gestaoDe(a);
    const bateNome = String(a['Nome'] || '').toLowerCase().indexOf(termo) !== -1;
    const bateStatus = statusFiltro === 'todos' || g.status === statusFiltro;
    const bateArquivado = mostrarArquivadas || g.arquivado !== 'Sim';
    return bateNome && bateStatus && bateArquivado;
  });

  const ordemNivel = { 'Avançado': 0, 'Intermediário': 1, 'Iniciante': 2 };
  filtradas.sort(function (a, b) {
    if (ordem === 'nome') return String(a['Nome']).localeCompare(String(b['Nome']));
    if (ordem === 'nivel') return (ordemNivel[a['Nível']] ?? 3) - (ordemNivel[b['Nível']] ?? 3);
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
    const seloRisco = { alto: '🔴', medio: '🟡', baixo: '🟢' }[risco.nivel];
    const tituloRisco = risco.sinais.length ? risco.sinais.map(function (s) { return s.texto; }).join(' · ') : 'Sem pendências';
    const badges = [
      '<span class="badge ' + (a['Nível'] === 'Avançado' ? 'badge-avancado' : a['Nível'] === 'Intermediário' ? 'badge-intermediario' : 'badge-iniciante') + '">' + (a['Nível'] || 'Sem ficha') + '</span>',
      '<span class="badge ' + (g.status === 'Inativo' ? 'badge-inativo' : 'badge-ativo') + '">' + g.status + '</span>',
      '<span class="badge ' + (g.pagamento === 'Devendo' ? 'badge-devendo' : 'badge-pago') + '">' + g.pagamento + (g.pagamento === 'Devendo' && g.valor ? ' R$' + g.valor : '') + '</span>'
    ];
    if (g.arquivado === 'Sim') badges.push('<span class="badge badge-arquivado">Arquivada</span>');
    if (parseInt(a['PAR-Q (positivos)']) > 0) badges.push('<span class="badge badge-risco">PAR-Q</span>');

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

['buscaAluna', 'ordenarAluna', 'filtroStatusAluna', 'mostrarArquivadasAluna'].forEach(function (id) {
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
      if (nomeAba === 'fotos') renderTabFotos(ALUNA_ATUAL);
      if (nomeAba === 'evolucao') renderTabEvolucao(ALUNA_ATUAL);
      if (nomeAba === 'checkins') renderTabCheckins(ALUNA_ATUAL);
      if (nomeAba === 'timeline') renderTabTimeline(ALUNA_ATUAL);
      if (nomeAba === 'financeiro') renderTabFinanceiro(ALUNA_ATUAL, gestaoDe(ALUNA_ATUAL));
      if (nomeAba === 'acoes') renderTabAcoes(ALUNA_ATUAL);
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
  renderTabTimeline(aluna);
  renderTabCheckins(aluna);
  renderTabEvolucao(aluna);
  renderTabFotos(aluna);
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

function renderTabCheckins(a) {
  const el = document.getElementById('tab-checkins');
  const lista = a.checkins || [];
  if (!lista.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Nenhum check-in registrado ainda.</p>'; return; }

  function linhaTabela(c) {
    const emojiHumor = { 'Animada': '😊', 'Tranquila': '🙂', 'Cansada': '😮\u200d💨', 'Estressada': '😣', 'Desanimada': '😔' };
    return '<tr><td>' + formatarDataHora(c['Data/Hora']) + '</td><td>' + (c['Peso'] || '—') + '</td><td>' + (c['Semana'] || '—') + '</td><td>' + (c['Energia'] ?? '—') + '/10</td><td>' + (c['Humor'] ? (emojiHumor[c['Humor']] || '') + ' ' + c['Humor'] : '—') + '</td><td>' + (c['Dor'] === 'Sim' ? '⚠ ' + (c['Onde a Dor'] || 'sim') : 'Não') + '</td><td>' + (c['Maior Dificuldade'] || '—') + '</td><td>' + (c['Observação'] || '—') + '</td></tr>';
  }

  function blocoTipo(tipo, emoji) {
    const doTipo = lista.filter(function (c) { return (c['Tipo'] || 'Semanal') === tipo; });
    if (!doTipo.length) {
      return '<div style="margin-bottom:1.6rem;"><span class="eyebrow">' + emoji + ' ' + tipo + '</span><p style="color:var(--ink-faint); font-size:.84rem;">Nenhum check-in ' + tipo.toLowerCase() + ' ainda.</p></div>';
    }
    return '<div style="margin-bottom:1.6rem;">' +
      '<span class="eyebrow">' + emoji + ' ' + tipo + ' · ' + doTipo.length + '</span>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Peso</th><th>Avaliação</th><th>Energia</th><th>Humor</th><th>Dor</th><th>Dificuldade</th><th>Observação</th></tr></thead><tbody>' +
      doTipo.map(linhaTabela).join('') +
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

function renderTabEvolucao(a) {
  const el = document.getElementById('tab-evolucao');
  const comPeso = (a.checkins || []).filter(function (c) { return c['Peso']; }).slice().reverse(); // ordem cronológica
  if (!comPeso.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Ainda não há registros de peso suficientes para mostrar evolução.</p>'; return; }
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

  el.innerHTML = html;
}

function extrairIdDrive(url) {
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
  const el = document.getElementById('tab-fotos');
  const lista = mesclarFotosPorDia(a.fotos || []).sort(function (x, y) { return new Date(y['Data/Hora']) - new Date(x['Data/Hora']); });
  if (!lista.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Nenhuma foto enviada ainda.</p>'; return; }

  const cronologica = lista.slice().reverse(); // mais antiga primeiro, para a comparação
  const opcoesData = cronologica.map(function (f, i) {
    return '<option value="' + i + '">' + formatarData(f['Data/Hora']) + '</option>';
  }).join('');

  let html = '';
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

  el.innerHTML = html;

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
    '<button class="btn btn-primary" id="btnSalvarFinanceiro">Salvar</button> ' +
    '<button class="btn btn-danger" id="btnExcluirAluna">Excluir aluna</button>';

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
      dataNascimento: dataNascimento
    };
    Api.salvarGestaoAluna(dados).then(function () {
      a.gestao = dados;
      a['Data de Nascimento'] = dataNascimento;
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

  let html = '<h3 style="font-size:.95rem; margin-bottom:.7rem;">WhatsApp</h3><div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.4rem;">';
  if (!whats) {
    html += '<p style="color:var(--ink-soft);">Esta aluna não tem telefone cadastrado.</p>';
  } else {
    html += botaoWhats('Boas-vindas', CONFIG.modelosWhatsapp.boasVindas);
    html += botaoWhats('Lembrete semanal', CONFIG.modelosWhatsapp.lembreteSemanal + CONFIG.linkCheckin);
    html += botaoWhats('Pedir check-in', CONFIG.modelosWhatsapp.solicitarCheckin + CONFIG.linkCheckin);
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
    const separador = CONFIG.linkCheckin.indexOf('?') === -1 ? '?' : '&';
    const link = CONFIG.linkCheckin + separador + 'tipo=' + encodeURIComponent(tipo);
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
    const nome = document.getElementById('novaAlunaNome').value.trim();
    if (!nome) { mostrarToast('Informe o nome da aluna.'); return; }
    const dados = {
      nome: nome,
      telefone: document.getElementById('novaAlunaTelefone').value.trim(),
      status: 'Ativo',
      pagamento: 'Pago',
      plano: document.getElementById('novaAlunaPlano').value.trim() || '—',
      valor: document.getElementById('novaAlunaValor').value,
      proximaRenovacao: '',
      arquivado: 'Não'
    };
    Api.salvarGestaoAluna(dados).then(function () {
      document.getElementById('modalNovaAluna').classList.remove('show');
      mostrarToast('Aluna cadastrada! Atualizando lista...');
      ['novaAlunaNome', 'novaAlunaTelefone', 'novaAlunaPlano', 'novaAlunaValor'].forEach(function (id) { document.getElementById(id).value = ''; });
      setTimeout(carregarDados, 1000);
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
