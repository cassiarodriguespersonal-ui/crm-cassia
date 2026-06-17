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

  /** Busca todas as alunas (ficha + gestão + check-ins + fotos já mesclados pelo backend). */
  function buscarAlunas() {
    const config = carregarConfig();
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
        resolve(dados);
      };

      const tag = document.createElement("script");
      tag.src = config.googleScriptUrl + "?callback=" + nomeCallback;
      tag.onerror = function () {
        clearTimeout(timeout);
        delete window[nomeCallback];
        reject(new Error("Não foi possível conectar ao Apps Script."));
      };
      document.body.appendChild(tag);
    });
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

  return {
    buscarAlunas,
    enviarAcao,
    salvarGestaoAluna,
    excluirAluna
  };
})();
