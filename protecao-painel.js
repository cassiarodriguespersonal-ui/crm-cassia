/**
 * ============================================================
 * PROTEÇÃO DO PAINEL — CONSULTORIA CÁSSIA
 * ============================================================
 * Como instalar:
 *
 * 1. Coloque este arquivo na mesma pasta do seu index.html
 * 2. No index.html, adicione esta linha bem no início da
 *    tag <head>, antes de qualquer outro script:
 *
 *      <script src="protecao-painel.js"></script>
 *
 * 3. Pronto. Ao abrir index.html sem estar logada, a página
 *    redireciona automaticamente para login.html.
 *
 * Se quiser um botão de "Sair" em algum lugar do painel, basta
 * chamar a função sairDoPainel() no clique dele:
 *
 *      <button onclick="sairDoPainel()">Sair</button>
 * ============================================================
 */

(function verificarAcesso() {
  const PAGINA_LOGIN = 'login.html';

  const status = sessionStorage.getItem('cassia_admin_auth');
  const expiraEm = sessionStorage.getItem('cassia_admin_auth_expira');
  const valido = status === 'ok' && expiraEm && Date.now() < Number(expiraEm);

  if (!valido) {
    sessionStorage.removeItem('cassia_admin_auth');
    sessionStorage.removeItem('cassia_admin_auth_expira');
    window.location.href = PAGINA_LOGIN;
  }
})();

function sairDoPainel() {
  sessionStorage.removeItem('cassia_admin_auth');
  sessionStorage.removeItem('cassia_admin_auth_expira');
  window.location.href = 'login.html';
}
