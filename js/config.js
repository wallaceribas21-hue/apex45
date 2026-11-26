/* APEX45 · projeto Supabase "apex45" (criado 25/11/2026, plano gratis, Sao Paulo).
   A chave abaixo e a "anon/publishable": publica por desenho. Quem protege os dados sao as regras (RLS) do schema.sql.
   NUNCA coloque aqui a chave "service_role".
   Regra de uso (25/11, Walla): aberto no computador (arquivo, localhost, 127.0.0.1) = MODO DEMO, pra gravar a tela
   sem mexer no banco. No ar (Netlify) = BANCO. Pra testar o banco no computador: abra com ?banco=1 no fim do endereco. */
(function () {
  var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var forca = /[?&]banco=1/.test(location.search);
  var usar = !local || forca;
  window.DESAFIO_CONFIG = usar
    ? { SUPABASE_URL: "https://qrhxaqdraijmuzbhcpsy.supabase.co", SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaHhhcWRyYWlqbXV6YmhjcHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2Mzk1OTMsImV4cCI6MjExMTIxNTU5M30.7qYReMc6coE33AO3xpTxsa95XGu3WMgvAqZjHLyOHRE" }
    : { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
})();
