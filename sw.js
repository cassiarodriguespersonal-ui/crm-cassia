/* ============================================================
   sw.js — Service Worker do CRM
   Cuida apenas do necessário para o app ser instalável e abrir
   rápido. Não armazena dados de alunas — esses sempre vêm direto
   do Google Sheets, nunca do cache.
   ============================================================ */

const CACHE_NOME = 'crm-cassia-v1';
const ARQUIVOS_BASE = [
  './index.html',
  './style.css',
  './app.js',
  './api.js',
  './config.js'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE_NOME).then(function (cache) {
      return cache.addAll(ARQUIVOS_BASE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes.filter(function (nome) { return nome !== CACHE_NOME; })
             .map(function (nome) { return caches.delete(nome); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (evento) {
  const url = new URL(evento.request.url);

  // Nunca cacheia chamadas ao Google Sheets/Apps Script — os dados das
  // alunas têm que ser sempre os mais recentes, nunca uma versão antiga.
  if (url.hostname.indexOf('google') !== -1) return;

  evento.respondWith(
    caches.match(evento.request).then(function (respostaCache) {
      const buscaRede = fetch(evento.request).then(function (respostaRede) {
        if (respostaRede && respostaRede.status === 200 && evento.request.method === 'GET') {
          const copia = respostaRede.clone();
          caches.open(CACHE_NOME).then(function (cache) { cache.put(evento.request, copia); });
        }
        return respostaRede;
      }).catch(function () { return respostaCache; });

      return respostaCache || buscaRede;
    })
  );
});
