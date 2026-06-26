/* ============================================================
   api.js
   Camada de comunicação com o Google Apps Script.
   ------------------------------------------------------------
   Leitura: técnica JSONP (contorna a limitação de CORS do
   Apps Script para requisições GET vindas de outro domínio).
   Escrita: formulário oculto + iframe (contorna a limitação de
   fetch() para POST em alguns navegadores/contextos).
   ============================================================ */

const Api = (function () {
  let _callbackContador = 0;

  /** Busca todas as alunas (ficha + gestão + check-ins + fotos já mesclados pelo backend).
   *  Use forcarAtualizacao=true para ignorar o cache de 90 segundos do backend
   *  e garantir os dados mais recentes (usado pelo botão "Atualizar dados").
   *  Cache local: na abertura, resolve imediatamente com dados salvos do localStorage
   *  e atualiza em segundo plano — elimina a espera na maioria dos acessos. */
  function buscarAlunas(forcarAtualizacao) {
    const config = carregarConfig();
    const CACHE_KEY = 'crm_alunas_cache';

    function buscarDoServidor(forcar) {
      return new Promise((resolve, reject) => {
        const nomeCallback = "__crmCallback" + (_callbackContador++);
        const timeout = setTimeout(() => {
          delete window[nomeCallback];
          reject(new Error("Tempo esgotado ao buscar dados. Verifique a URL do Apps Script em Configurações."));
        }, 12000);

        window[nomeCallback] = function (dados) {
          clearTimeout(timeout);
          delete window[nomeCallback];
          tag.remove();
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(dados)); } catch (e) {}
          resolve(dados);
        };

        const tag = document.createElement("script");
        tag.src = config.googleScriptUrl + "?callback=" + nomeCallback + (forcar ? "&forcar=1" : "");
        tag.onerror = function () {
          clearTimeout(timeout);
          delete window[nomeCallback];
          reject(new Error("Não foi possível conectar ao Apps Script."));
        };
        document.body.appendChild(tag);
      });
    }

    // Se forçar atualização (botão manual ou timer), ignora cache e busca direto
    if (forcarAtualizacao) return buscarDoServidor(true);

    // Na abertura normal: tenta servir do cache imediatamente
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const dados = JSON.parse(cached);
        // Atualiza em segundo plano silenciosamente
        setTimeout(function () {
          buscarDoServidor(false).then(function (novosDados) {
            novosDados.forEach(function (a) {
              if (typeof formatarNomeProprio === 'function') a['Nome'] = formatarNomeProprio(a['Nome']);
            });
            ALUNAS = novosDados;
            const secaoAtiva = document.querySelector('.section.active');
            if (secaoAtiva && typeof mostrarSecao === 'function') {
              mostrarSecao(secaoAtiva.id.replace('section-', ''));
            }
          }).catch(function () {}); // falha silenciosa — cache já foi exibido
        }, 100);
        return Promise.resolve(dados);
      }
    } catch (e) {}

    // Sem cache: primeira abertura, busca normalmente
    return buscarDoServidor(false);
  }

  /** Envia uma ação de escrita (gestao_aluno, excluir_aluno, checkin...) via formulário oculto. */
  function enviarAcao(payload) {
    const config = carregarConfig();
    return new Promise((resolve) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = config.googleScriptUrl;
      form.target = "hiddenFrameApi";
      form.style.display = "none";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      input.value = JSON.stringify(payload);
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        form.remove();
        resolve(true); // fire-and-forget: não há confirmação de leitura possível aqui
      }, 1200);
    });
  }

  function salvarGestaoAluna(dados) {
    return enviarAcao(Object.assign({ tipo: "gestao_aluno" }, dados));
  }

  function excluirAluna(nome) {
    return enviarAcao({ tipo: "excluir_aluno", nome: nome });
  }

  /** Envia o mesmo e-mail (com {nome} personalizado por pessoa) para uma lista
   *  de destinatárias de uma vez, de verdade — sem precisar abrir nada manualmente. */
  function enviarEmailEmLote(destinatarios, assunto, corpoTemplate) {
    return enviarAcao({
      tipo: "envio_em_massa_email",
      destinatarios: destinatarios,
      assunto: assunto,
      corpo: corpoTemplate
    });
  }

  return {
    buscarAlunas,
    enviarAcao,
    salvarGestaoAluna,
    excluirAluna,
    enviarEmailEmLote
  };
})();
