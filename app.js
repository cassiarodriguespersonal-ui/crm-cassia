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
  document.getElementById('bottomNavMais').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

const TITULOS_SECAO = {
  dashboard: ['Dashboard', 'Visão geral da consultoria'],
  alunas: ['Gestão de alunos', 'Todas as alunas, fichas e cadastros manuais'],
  checkins: ['Check-ins', 'Envio e histórico de check-ins'],
  financeiro: ['Financeiro', 'Pagamentos, planos e renovações'],
  ferramentas: ['Ferramentas', 'Atalhos, modelos e envio de mensagens'],
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
  if (nome === 'ferramentas') { renderCompartilhar(); renderModelosUnificados(); renderEnvioFerramenta(); }
}

function ligarTopbar() {
  document.getElementById('btnAtualizar').addEventListener('click', carregarDados);
  document.getElementById('btnLimparAlertas').addEventListener('click', function () {
    localStorage.setItem('crm_alertas_limpos_em', new Date().toDateString());
    renderDashboard();
    mostrarToast('Alertas limpos por hoje.');
  });
}

/* ---------- CARREGAMENTO DE DADOS ---------- */
function carregarDados() {
  mostrarToast('Atualizando dados...');
  Api.buscarAlunas().then(function (dados) {
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

/* ============================================================
   DASHBOARD
   ============================================================ */
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

  // ---- Saudação ----
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNomeDela = primeiroNome(CONFIG.meuNome) || 'Cássia';
  document.getElementById('textoSaudacao').textContent = saudacao + ', ' + primeiroNomeDela;

  // ---- Ícones de indicadores (clicáveis) ----
  document.getElementById('iconStatRow').innerHTML = [
    ['📅', checkinsPendentes, 'Check-ins', 'checkins'],
    ['💳', pagamentosPendentes, 'Pagamentos', 'financeiro'],
    ['📸', fotosPendentes, 'Fotos', 'alunas'],
    ['🔔', reavaliacoesProximas, 'Renovações', 'financeiro']
  ].map(function (s) {
    return '<div class="icon-stat" data-ir-para="' + s[3] + '">' +
      '<div class="circulo">' + s[0] + (s[1] > 0 ? '<span class="badge-contagem">' + s[1] + '</span>' : '') + '</div>' +
      '<div class="legenda">' + s[2] + '</div>' +
    '</div>';
  }).join('');
  document.querySelectorAll('.icon-stat').forEach(function (el) {
    el.addEventListener('click', function () { mostrarSecao(el.getAttribute('data-ir-para')); });
  });

  // ---- Cartão "Seus alunos" ----
  document.getElementById('pillsResumoAlunos').innerHTML =
    '<span class="pill ativos">Ativos: ' + ativas + '</span>' +
    '<span class="pill inativos">Inativos: ' + inativas + '</span>';
  document.getElementById('cardResumoAlunos').onclick = function () { mostrarSecao('alunas'); };

  // ---- Quem precisa de carinho (cards por aluna) ----
  const candidatas = [];
  visiveis.forEach(function (a) {
    const nome = a['Nome'];
    const sinais = [];
    let urgente = false;

    const diasCheckin = a.ultimoCheckin ? diasDesde(a.ultimoCheckin['Data/Hora']) : null;
    if (diasCheckin === null || diasCheckin >= CONFIG.diasAlertaCheckin) {
      sinais.push({ texto: '💬 ' + (diasCheckin === null ? 'Nunca fez check-in' : 'Sem contato há ' + diasCheckin + 'd'), risco: diasCheckin === null || diasCheckin >= CONFIG.diasAlertaCheckin * 2 });
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

    if (sinais.length) {
      candidatas.push({ nome: nome, telefone: a['Telefone'], sinais: sinais, urgente: urgente, diasCheckin: diasCheckin === null ? 9999 : diasCheckin });
    }
  });
  candidatas.sort(function (x, y) { return (y.urgente - x.urgente) || (y.diasCheckin - x.diasCheckin); });

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

  // Últimas atividades (fichas + check-ins combinados)
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
  });
  atividades.sort(function (x, y) { return new Date(y.quando) - new Date(x.quando); });
  const elAtiv = document.getElementById('dashboardAtividades');
  elAtiv.innerHTML = atividades.length
    ? atividades.slice(0, 10).map(function (a) {
        return '<div class="activity-item"><span>' + a.texto + '</span><span class="quando">' + formatarDataHora(a.quando) + '</span></div>';
      }).join('')
    : '<div class="alert-empty">Nenhuma atividade registrada ainda.</div>';
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
  const selNome = document.getElementById('ferramentaNome');
  selNome.innerHTML = alunasVisiveis().map(function (a) {
    return '<option value="' + a['Nome'] + '">' + a['Nome'] + '</option>';
  }).join('') || '<option value="">Nenhuma aluna cadastrada</option>';

  function atualizarModelos() {
    const canal = document.getElementById('ferramentaCanal').value;
    const rotulos = canal === 'whatsapp' ? ROTULOS_MODELO_WHATS : ROTULOS_MODELO_EMAIL;
    document.getElementById('ferramentaModelo').innerHTML = Object.keys(rotulos).map(function (k) {
      return '<option value="' + k + '">' + rotulos[k] + '</option>';
    }).join('');
  }
  atualizarModelos();
  document.getElementById('ferramentaCanal').onchange = atualizarModelos;

  document.getElementById('btnEnviarFerramenta').onclick = function () {
    const nome = selNome.value;
    const aluna = ALUNAS.find(function (a) { return a['Nome'] === nome; });
    if (!aluna) { mostrarToast('Selecione uma aluna.'); return; }

    const canal = document.getElementById('ferramentaCanal').value;
    const chave = document.getElementById('ferramentaModelo').value;

    if (canal === 'whatsapp') {
      const whats = telefoneParaWhats(aluna['Telefone']);
      if (!whats) { mostrarToast('Essa aluna não tem telefone cadastrado.'); return; }
      var texto = (CONFIG.modelosWhatsapp[chave] || '').replace(/\{nome\}/g, primeiroNome(nome));
      if (chave === 'solicitarCheckin') texto += CONFIG.linkCheckin;
      if (chave === 'solicitarFotos') texto += CONFIG.linkGuiaFotos;
      window.open('https://wa.me/' + whats + '?text=' + encodeURIComponent(texto), '_blank');
    } else {
      if (!aluna['E-mail']) { mostrarToast('Essa aluna não tem e-mail cadastrado.'); return; }
      const modelo = CONFIG.modelosEmail[chave];
      const corpo = (modelo.corpo || '').replace(/\{nome\}/g, nome);
      window.location.href = 'mailto:' + aluna['E-mail'] + '?subject=' + encodeURIComponent(modelo.assunto) + '&body=' + encodeURIComponent(corpo);
    }
  };
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
    const badges = [
      '<span class="badge ' + (a['Nível'] === 'Avançado' ? 'badge-avancado' : a['Nível'] === 'Intermediário' ? 'badge-intermediario' : 'badge-iniciante') + '">' + (a['Nível'] || 'Sem ficha') + '</span>',
      '<span class="badge ' + (g.status === 'Inativo' ? 'badge-inativo' : 'badge-ativo') + '">' + g.status + '</span>',
      '<span class="badge ' + (g.pagamento === 'Devendo' ? 'badge-devendo' : 'badge-pago') + '">' + g.pagamento + (g.pagamento === 'Devendo' && g.valor ? ' R$' + g.valor : '') + '</span>'
    ];
    if (g.arquivado === 'Sim') badges.push('<span class="badge badge-arquivado">Arquivada</span>');
    if (parseInt(a['PAR-Q (positivos)']) > 0) badges.push('<span class="badge badge-risco">PAR-Q</span>');

    return '<div class="aluna-card' + arquivadaClasse + '">' +
      '<div class="aluna-info">' +
        '<div class="nome">' + (a['Nome'] || '—') + '</div>' +
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
  document.querySelectorAll('.modal-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.modal-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('tab-' + tab.getAttribute('data-tab')).classList.add('active');
    });
  });
}

let ALUNA_ATUAL = null;

function abrirModalAluna(aluna) {
  ALUNA_ATUAL = aluna;
  const g = gestaoDe(aluna);
  document.getElementById('modalAlunaNome').textContent = aluna['Nome'] || '—';
  document.getElementById('modalAlunaSub').textContent = aluna.origem === 'manual' ? 'Cadastro manual, sem ficha de anamnese' : 'Nível ' + (aluna['Nível'] || '—');

  renderTabResumo(aluna);
  renderTabCheckins(aluna);
  renderTabEvolucao(aluna);
  renderTabFotos(aluna);
  renderTabFinanceiro(aluna, g);
  renderTabAcoes(aluna);

  document.querySelectorAll('.modal-tab')[0].click();
  document.getElementById('modalAluna').classList.add('show');
}

function linhaInfo(label, valor) {
  return '<div><b>' + label + '</b>' + (valor || valor === 0 ? valor : '—') + '</div>';
}

function renderTabResumo(a) {
  const el = document.getElementById('tab-resumo');
  if (a.origem === 'manual') {
    el.innerHTML = '<p style="color:var(--ink-soft);">Esta aluna foi cadastrada manualmente, sem ficha de anamnese preenchida.</p>';
    return;
  }
  el.innerHTML = '<div class="info-grid">' +
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
    linhaInfo('Peso', a['Peso (kg)'] ? a['Peso (kg)'] + ' kg' : '') +
    linhaInfo('Altura', a['Altura (cm)'] ? a['Altura (cm)'] + ' cm' : '') +
    linhaInfo('IMC', a['IMC'] ? a['IMC'] + ' (' + a['Classificação IMC'] + ')' : '') +
    linhaInfo('PAR-Q', parseInt(a['PAR-Q (positivos)']) > 0 ? '⚠ ' + a['PAR-Q (positivos)'] + ' sinal(is) positivo(s)' : 'Sem sinais') +
    linhaInfo('Observações', a['Observações Finais']) +
  '</div>';
}

function renderTabCheckins(a) {
  const el = document.getElementById('tab-checkins');
  const lista = a.checkins || [];
  if (!lista.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Nenhum check-in registrado ainda.</p>'; return; }

  function linhaTabela(c) {
    return '<tr><td>' + formatarDataHora(c['Data/Hora']) + '</td><td>' + (c['Peso'] || '—') + '</td><td>' + (c['Semana'] || '—') + '</td><td>' + (c['Energia'] ?? '—') + '/10</td><td>' + (c['Dor'] === 'Sim' ? '⚠ ' + (c['Onde a Dor'] || 'sim') : 'Não') + '</td><td>' + (c['Observação'] || '—') + '</td></tr>';
  }

  function blocoTipo(tipo, emoji) {
    const doTipo = lista.filter(function (c) { return (c['Tipo'] || 'Semanal') === tipo; });
    if (!doTipo.length) {
      return '<div style="margin-bottom:1.6rem;"><span class="eyebrow">' + emoji + ' ' + tipo + '</span><p style="color:var(--ink-faint); font-size:.84rem;">Nenhum check-in ' + tipo.toLowerCase() + ' ainda.</p></div>';
    }
    return '<div style="margin-bottom:1.6rem;">' +
      '<span class="eyebrow">' + emoji + ' ' + tipo + ' · ' + doTipo.length + '</span>' +
      '<table class="data-table"><thead><tr><th>Data</th><th>Peso</th><th>Avaliação</th><th>Energia</th><th>Dor</th><th>Observação</th></tr></thead><tbody>' +
      doTipo.map(linhaTabela).join('') +
      '</tbody></table></div>';
  }

  el.innerHTML = blocoTipo('Semanal', '📅') + blocoTipo('Mensal', '🗓️') + blocoTipo('Trimestral', '📆');
}

function renderTabEvolucao(a) {
  const el = document.getElementById('tab-evolucao');
  const comPeso = (a.checkins || []).filter(function (c) { return c['Peso']; }).slice().reverse(); // ordem cronológica
  if (!comPeso.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Ainda não há registros de peso suficientes para mostrar evolução.</p>'; return; }
  const primeiro = parseFloat(comPeso[0]['Peso']);
  const ultimo = parseFloat(comPeso[comPeso.length - 1]['Peso']);
  const diferenca = (ultimo - primeiro).toFixed(1);
  el.innerHTML = '<p style="font-size:.9rem;"><b>Variação total:</b> ' + (diferenca > 0 ? '+' : '') + diferenca + ' kg desde o primeiro registro (' + formatarData(comPeso[0]['Data/Hora']) + ').</p>' +
    '<table class="data-table"><thead><tr><th>Data</th><th>Peso (kg)</th></tr></thead><tbody>' +
    comPeso.slice().reverse().map(function (c) { return '<tr><td>' + formatarData(c['Data/Hora']) + '</td><td>' + c['Peso'] + '</td></tr>'; }).join('') +
    '</tbody></table>';
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

function renderTabFotos(a) {
  const el = document.getElementById('tab-fotos');
  const lista = (a.fotos || []).slice().sort(function (x, y) { return new Date(y['Data/Hora']) - new Date(x['Data/Hora']); });
  if (!lista.length) { el.innerHTML = '<p style="color:var(--ink-soft);">Nenhuma foto enviada ainda.</p>'; return; }
  el.innerHTML = '<div class="fotos-grid">' + lista.map(function (f) {
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
    '</div>' +
    '<button class="btn btn-primary" id="btnSalvarFinanceiro">Salvar</button> ' +
    '<button class="btn btn-danger" id="btnExcluirAluna">Excluir aluna</button>';

  document.getElementById('btnSalvarFinanceiro').addEventListener('click', function () {
    const dados = {
      nome: a['Nome'],
      telefone: a['Telefone'] || '',
      status: document.getElementById('fStatus').value,
      pagamento: document.getElementById('fPagamento').value,
      plano: document.getElementById('fPlano').value || '—',
      valor: document.getElementById('fValor').value,
      proximaRenovacao: document.getElementById('fRenovacao').value,
      arquivado: document.getElementById('fArquivado').value
    };
    Api.salvarGestaoAluna(dados).then(function () {
      a.gestao = dados;
      mostrarToast('Dados salvos!');
      renderAlunas();
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
    html = '<p style="color:var(--ink-soft);">Esta aluna não tem telefone cadastrado.</p>';
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
const ROTULOS_MODELOS_UNIFICADOS = { boasVindas: 'Boas-vindas', lembreteSemanal: 'Lembrete semanal', solicitarCheckin: 'Solicitação de check-in', solicitarFotos: 'Solicitação de fotos', lembretePagamento: 'Lembrete de pagamento', motivacao: 'Motivação', renovacao: 'Renovação da consultoria' };

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
  document.getElementById('cfgDiasCheckin').value = CONFIG.diasAlertaCheckin;
  document.getElementById('cfgDiasFotos').value = CONFIG.diasAlertaFotos;

  document.getElementById('btnSalvarConfig').addEventListener('click', function () {
    CONFIG.googleScriptUrl = document.getElementById('cfgScriptUrl').value.trim();
    CONFIG.meuNome = document.getElementById('cfgMeuNome').value.trim();
    CONFIG.meuWhatsapp = document.getElementById('cfgMeuWhatsapp').value.trim();
    CONFIG.meuEmail = document.getElementById('cfgMeuEmail').value.trim();
    CONFIG.linkFicha = document.getElementById('cfgLinkFicha').value.trim();
    CONFIG.linkGuiaFotos = document.getElementById('cfgLinkGuiaFotos').value.trim();
    CONFIG.linkCheckin = document.getElementById('cfgLinkCheckin').value.trim();
    CONFIG.diasAlertaCheckin = parseInt(document.getElementById('cfgDiasCheckin').value) || 7;
    CONFIG.diasAlertaFotos = parseInt(document.getElementById('cfgDiasFotos').value) || 30;
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
