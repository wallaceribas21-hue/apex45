/* Telas do app do Desafio. HTML + JS puro, sem build.
   Telas: Entrar, Metas, Hoje, Grupo, Meu total, Semana (quiz), Admin. */
(function () {
  "use strict";
  var R = window.Regras, cfg = window.DESAFIO_CONFIG || {};
  var COM_BANCO = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var Store, D = null; // D = dados carregados
  var app = document.getElementById("app");
  var estado = { dia: "hoje", aba: "total" };

  // ---------- helpers ----------
  function h(tag, attrs) {
    var el = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "on") Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
      else if (k === "value") el.value = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    (function add(list) { list.forEach(function (c) { if (Array.isArray(c)) add(c); else if (c != null && c !== false) el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c))); }); })(kids);
    return el;
  }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function dataBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; }
  function dataBRfull(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  var NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  function nomeDia(iso) { return NOMES_DIA[R.dow(iso)]; }
  function num1(n) { return (Math.round(n * 10) / 10).toString().replace(".", ","); }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function toast(msg) {
    var t = h("div", { class: "toast", role: "status" }, msg); document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }
  function tentar(promise, msgErro) {
    return promise.catch(function (e) { toast((msgErro || "Não salvou") + ": " + (e && e.message ? e.message : e)); throw e; });
  }

  // ---------- visual e interacao (v4, 25/11 noite) ----------
  var REDUZ = false; try { REDUZ = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var vistos = {}, rotaAnt = null; // vistos = ultimo valor mostrado de cada numero/barra (anima de onde estava)
  var ICONE = {
    sono: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    treino: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    leitura: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/>',
    agua: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>',
    alimentacao: '<path d="M6 3.5v6a2.5 2.5 0 0 0 5 0v-6M8.5 3.5v17M17.5 20.5v-8M17.5 12.5c-2 0-3-1.5-3-4.5s1-4.5 3-4.5z"/>',
    devocional: '<path d="M12 3.5v17M7 8.5h10"/>',
    culto: '<path d="M12 2.5v5M10 4.5h4M5 20.5v-7l7-5 7 5v7zM10 20.5v-4.5h4v4.5"/>',
    individual: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    reels: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
    chama: '<path d="M12 3.5c.5 3.5-4 5.5-4 10a4 4 0 0 0 8 0c0-1.5-.6-2.6-1.4-3.6-.3 1.2-.9 1.9-1.6 2.3.4-3-.2-6-1-8.7z"/><path d="M6.5 13.5a5.5 5.5 0 0 0 11 0"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    n_hoje: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
    n_grupo: '<path d="M3.5 20.5v-7H9v7M9 20.5v-12h6v12M15 20.5v-9h5.5v9M2.5 20.5h19"/>',
    n_total: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    n_semana: '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    n_admin: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'
  };
  function icone(nome, cls) {
    var s = h("span", { class: "ic" + (cls ? " " + cls : ""), "aria-hidden": "true" });
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONE[nome] || ICONE.individual) + "</svg>";
    return s;
  }
  function depois(f) { requestAnimationFrame(function () { requestAnimationFrame(f); }); }
  function conta(el, chave, alvo, fmt) { // numero que sobe ate o valor
    fmt = fmt || function (n) { return Math.round(n); };
    var de = vistos[chave]; if (de == null) de = 0; vistos[chave] = alvo;
    if (REDUZ || de === alvo) { el.textContent = fmt(alvo); return el; }
    el.textContent = fmt(de); var t0 = null, dur = 650;
    requestAnimationFrame(function passo(t) {
      if (t0 == null) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(de + (alvo - de) * e); if (k < 1) requestAnimationFrame(passo);
    });
    return el;
  }
  function cresce(el, prop, chave, alvo, unid) { // barra que cresce de onde estava
    unid = unid || "%"; var de = vistos[chave]; if (de == null) de = 0; vistos[chave] = alvo;
    if (REDUZ) { el.style[prop] = alvo + unid; return el; }
    el.style[prop] = de + unid; depois(function () { el.style[prop] = alvo + unid; }); return el;
  }
  function vibra(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function festa(txt, forte) { // comemoracao de pontos: numero sobe e fagulhas saem
    vibra(forte ? [20, 40, 30] : 15);
    if (REDUZ) return;
    var box = h("div", { class: "festa" + (forte ? " forte" : ""), "aria-hidden": "true" }, h("b", { class: "mono" }, txt)), n = forte ? 22 : 12;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.4, dist = (forte ? 110 : 70) + Math.random() * 50;
      box.appendChild(h("i", { style: "--x:" + Math.round(Math.cos(a) * dist) + "px;--y:" + Math.round(Math.sin(a) * dist) + "px;animation-delay:" + Math.round(Math.random() * 80) + "ms" + (i % 3 === 0 ? ";background:#fff" : "") }));
    }
    document.body.appendChild(box); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1400);
  }
  function iniciais(nome) { var p = String(nome || "?").trim().split(/\s+/); return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase(); }
  function copiar(txt, aviso) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(aviso || "Copiado"); }, function () { toast("Não deu pra copiar. Tire um print."); });
    else toast("Não deu pra copiar. Tire um print.");
  }
  function trilhaVazia() { var c = []; for (var i = 0; i < 45; i++) c.push(h("i", { style: "--i:" + i })); return h("div", { class: "trilha demo", "aria-hidden": "true" }, c); }
  function dispara(inp) { inp.dispatchEvent(new Event("input", { bubbles: true })); }
  function lerNum(inp) { return +String(inp.value).replace(",", ".") || 0; }
  function passos(inp, incs, quebrado) { // botoes de somar num campo de numero
    function fmtN(v) { return quebrado ? String(Math.round(v * 100) / 100) : String(Math.round(v)); }
    return h("div", { class: "passos" },
      h("button", { type: "button", "aria-label": "Diminuir", on: { click: function () { inp.value = fmtN(Math.max(0, lerNum(inp) - incs[0])); dispara(inp); vibra(8); } } }, "−"),
      incs.map(function (n) { return h("button", { type: "button", on: { click: function () { inp.value = fmtN(lerNum(inp) + n); dispara(inp); vibra(8); } } }, "+" + String(n).replace(".", ",")); }));
  }
  function atalhos(inp, vals, unid) { // botoes que escrevem um valor pronto
    return h("div", { class: "passos" }, vals.map(function (n) { return h("button", { type: "button", on: { click: function () { inp.value = n; dispara(inp); vibra(8); } } }, n + (unid || "")); }));
  }
  function medidor(inp, meta, unid, minimo) { // barra que enche enquanto a pessoa digita
    var fill = h("i", {}), txt = h("span", { class: "mono" });
    var box = h("div", { class: "medidor" }, h("div", { class: "med-trilho" }, fill, minimo ? h("u", { style: "left:" + Math.min(100, (minimo / meta) * 100) + "%" }) : null), txt);
    function at() {
      var v = lerNum(inp); fill.style.width = Math.min(100, (v / meta) * 100) + "%";
      box.className = "medidor" + (v >= meta ? " ok" : minimo && v >= minimo ? " meio" : "");
      txt.textContent = num1(v) + " de " + num1(meta) + " " + unid + (v >= meta ? " · bate a meta" : minimo && v >= minimo ? " · vale a versão mínima" : "");
    }
    inp.addEventListener("input", at); at(); return box;
  }
  function segmento(ops, ini, coluna) { // escolha por botoes (no lugar da caixa de selecao)
    var val = ini, api = { el: h("div", { class: "seg" + (coluna ? " col" : ""), role: "radiogroup" }) };
    var bs = ops.map(function (o) { var b = h("button", { type: "button", class: "seg-b", role: "radio", on: { click: function () { val = o[0]; pinta(); vibra(8); } } }, o[1]); api.el.appendChild(b); return b; });
    function pinta() { bs.forEach(function (b, i) { var on = ops[i][0] === val; b.className = "seg-b" + (on ? " on" : ""); b.setAttribute("aria-checked", on ? "true" : "false"); }); }
    pinta(); Object.defineProperty(api, "value", { get: function () { return val; } }); return api;
  }
  function folha(titulo, corpo) { // janela que sobe de baixo, so pra ler
    var fundo = h("div", { class: "fundo", role: "dialog", "aria-modal": "true", "aria-label": titulo, on: { click: function (e) { if (e.target === fundo) fechar(); } } });
    function fechar() { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") fechar(); }
    document.addEventListener("keydown", esc);
    fundo.appendChild(h("div", { class: "janela" }, h("div", { class: "pega" }), h("h3", {}, titulo), corpo, h("button", { class: "btn sec", type: "button", on: { click: fechar } }, "Fechar")));
    document.body.appendChild(fundo); return fechar;
  }

  // ---------- metas (catalogo) ----------
  var CATALOGO = [
    { id: "sono", nome: "Sono", regra: "Mínimo 7 h, no horário combinado" },
    { id: "treino", nome: "Treino", regra: "Musculação 3x e cardio 2x por semana" },
    { id: "leitura", nome: "Leitura", regra: "20 páginas (Hábitos Atômicos)" },
    { id: "agua", nome: "Água", regra: "Mínimo 3 L" },
    { id: "alimentacao", nome: "Alimentação", regra: "3 refeições, sem doces e industrializados" },
    { id: "devocional", nome: "Espiritual", regra: "Devocional diário e culto de domingo" }
  ];
  var NOME_META = { sono: "Sono", treino: "Treino", leitura: "Leitura", agua: "Água", alimentacao: "Alimentação", devocional: "Espiritual", culto: "Culto", reels: "Reels", individual: "Meta individual" };
  var HABITO_PADRAO = "doces e industrializados"; // card do grupo 25/11
  // versao minima (dia ruim): o que vale metade dos pontos e segura a sequencia
  var MINIMO_TXT = { sono: "6 h", treino: "10 min de movimento", leitura: "5 páginas", agua: "2 L", alimentacao: "2 refeições", devocional: "1 oração curta" };
  function agoraHHMM() { if (D && D.agora) return D.agora; if (Store && Store.agora) return Store.agora(); var x = new Date(); return (x.getHours() < 10 ? "0" : "") + x.getHours() + ":" + (x.getMinutes() < 10 ? "0" : "") + x.getMinutes(); }
  function gravando() { return !!(D && D.gravacao); }
  function primeiroNome(n) { return String(n || "").split(" ")[0]; }

  // ---------- roteamento ----------
  function rota() { return (location.hash || "#/").replace(/^#\/?/, "") || ""; }
  function ir(r) { location.hash = "#/" + r; }
  window.addEventListener("hashchange", function () { desenhar(); });

  function recarregar() {
    return Store.carregar().then(function (d) { D = d; });
  }
  function desenhar() {
    var yAntes = window.pageYOffset || 0;
    limpar(app);
    var sess = Store.sessao();
    var r = rota();
    var mudou = r !== rotaAnt; rotaAnt = r; if (mudou) vistos = {};
    if (!sess) { return telaEntrar(); }
    if (!D) { app.appendChild(h("p", { class: "apoio", style: "padding-top:40px" }, "Carregando...")); return; }
    if (D.semDesafio) return telaSemDesafio();
    if (!D.me || !D.me.nome) { if (r !== "metas") { ir("metas"); return; } return telaConversa(); }
    var mapa = { hoje: telaHoje, grupo: telaGrupo, total: telaTotal, semana: telaSemana, admin: telaAdmin, metas: function () { telaMetas(false); } };
    var f = mapa[r];
    if (!f) { ir("hoje"); return; }
    app.appendChild(topo());
    var tela = h("div", { class: "tela" + (mudou ? " entra" : "") }); app.appendChild(tela);
    f(tela);
    if (r === "total") { var cc = cartaoCodigo(); if (cc) tela.appendChild(cc); if (COM_BANCO) tela.appendChild(h("button", { class: "btn sec", on: { click: sairComAviso } }, "Sair")); }
    app.appendChild(navegacao(r));
    window.scrollTo(0, mudou ? 0 : yAntes); // mesma tela: fica onde estava
  }

  function topo() {
    var d = D.desafio;
    var info = [];
    if (gravando()) return h("div", { class: "topo" }, h("div", { class: "assina" }, "APEX45"));
    if (D.modo === "demo") info.push(h("span", { class: "selo laranja" }, "Demo"));
    if (d && !d.data_confirmada) info.push(h("span", { class: "selo", title: "A data de início ainda precisa ser confirmada" }, "Datas a confirmar"));
    return h("div", { class: "topo" }, h("div", { class: "assina" }, "APEX45"), h("div", { style: "display:flex;gap:6px" }, info));
  }
  function navegacao(r) {
    var itens = [["hoje", "Hoje"], ["grupo", "Grupo"], ["total", "Meu total"], ["semana", "Semana"]];
    if (D.admin) itens.push(["admin", "Admin"]);
    return h("nav", { class: "tabs", "aria-label": "Telas" }, h("div", { class: "in" }, itens.map(function (i) {
      return h("a", { href: "#/" + i[0], class: r === i[0] ? "on" : "", "aria-current": r === i[0] ? "page" : null }, icone("n_" + i[0]), h("span", {}, i[1]));
    })));
  }

  // ---------- 1. Entrar ----------
  // v3 (25/11): com banco, cada um entra com 1 toque (sem e-mail) e guarda um codigo pessoal pra outro celular
  function caixaCodigo(rotulo) {
    var msg = h("p", { class: "erro" });
    var cod = h("input", { id: "codigo", placeholder: "Ex.: K7P2QX", maxlength: 8, autocomplete: "off", autocapitalize: "characters", spellcheck: "false", style: "text-transform:uppercase;letter-spacing:3px" });
    var btn = h("button", { class: "btn sec", type: "submit" }, "Entrar com meu código");
    return h("form", { style: "margin-top:26px", on: { submit: function (e) {
      e.preventDefault();
      var v = cod.value.replace(/[^A-Za-z0-9]/g, "");
      if (v.length < 6) { msg.textContent = "O código tem 6 letras/números."; return; }
      btn.disabled = true; msg.textContent = "";
      Store.entrarComCodigo(v).then(iniciar).then(function () { ir("hoje"); desenhar(); })
        .catch(function (er) { msg.textContent = er.message; }).then(function () { btn.disabled = false; });
    } } }, h("label", { for: "codigo" }, rotulo || "Já participa e trocou de celular?"), cod, btn, msg);
  }
  function modoAdmin() { return !COM_BANCO || /[?&]admin=1/.test(location.search); }
  function temConviteNaUrl() { return /[?&]convite=/.test(location.search); }
  function abertoPeloIcone() { try { return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; } catch (e) { return false; } }
  function botaoEntrarNoDesafio() {
    var msg = h("p", { class: "erro" });
    var btn = h("button", { class: "btn", type: "button", on: { click: function () {
      btn.disabled = true; btn.textContent = "Entrando..."; msg.textContent = "";
      Store.entrarDireto().then(iniciar).then(function () { ir(D && D.me && D.me.nome ? "hoje" : "metas"); desenhar(); })
        .catch(function (er) { msg.textContent = er.message; btn.disabled = false; btn.textContent = "Entrar no desafio"; });
    } } }, "Entrar no desafio");
    return h("div", {}, btn, msg);
  }
  function telaEntrarDireto() {
    var temConvite = temConviteNaUrl();
    var icone = abertoPeloIcone();
    var codigoPrimeiro = icone || (!temConvite && !modoAdmin());
    var rotulo = icone ? "Abriu pelo ícone da tela de início? Ele começa vazio: digite seu código" : (temConvite ? "Já participa (outro celular ou outro navegador)? Use seu código" : "Seu código de acesso");
    var texto = icone ? "Se você já entrou antes no navegador, use seu código. Primeira vez? Toque em Entrar."
      : temConvite ? "Primeira vez? Toque em Entrar, escreva seu nome e suas metas. Não precisa de e-mail nem senha."
      : modoAdmin() ? "Modo Admin: entre para criar o desafio."
      : "Abra pelo link que o grupo mandou. Se você já participa, digite seu código.";
    var podeEntrar = temConvite || modoAdmin();
    app.appendChild(h("div", { class: "hero" },
      h("div", { class: "assina", style: "margin-bottom:22px" }, "APEX45"),
      trilhaVazia(),
      h("h1", {}, h("b", {}, "45 dias."), " ", h("span", {}, "Hábito que continua depois.")),
      h("p", { class: "apoio", style: "margin-top:14px" }, texto),
      codigoPrimeiro ? caixaCodigo(rotulo) : null,
      podeEntrar ? botaoEntrarNoDesafio() : null,
      codigoPrimeiro ? null : caixaCodigo(rotulo)));
  }
  function cartaoCodigo() {
    if (!D || !D.me) return null;
    if (!D.me.codigo_acesso) return COM_BANCO && Store.entrarComCodigo ? h("div", { class: "faixa" }, h("b", {}, "Código ainda não saiu. "), "Avise o Admin: sem ele você não volta em outro celular.") : null;
    return h("div", { class: "card" }, h("h3", {}, "Seu código de acesso"),
      h("div", { class: "mono", style: "font-size:30px;font-weight:700;letter-spacing:4px;margin:6px 0" }, D.me.codigo_acesso),
      h("button", { class: "btn sec", type: "button", style: "margin:4px 0 12px", on: { click: function () { copiar(D.me.codigo_acesso, "Código copiado"); } } }, "Copiar código"),
      h("p", { class: "apoio" }, "Tire um print. Em outro celular (ou se abrir pelo ícone da tela de início), abra o link do grupo e digite estas letras em \"Use seu código\": volta tudo, com seus pontos."));
  }
  function sairComAviso() {
    var s = Store.sessao(), c = D && D.me && D.me.codigo_acesso;
    if (s && s.anonimo && !confirm(c ? "Antes de sair, anote seu código: " + c + ". Sem ele você não volta para a sua conta. Sair mesmo?" : "Você entrou sem e-mail. Saindo, só volta com seu código. Sair mesmo?")) return;
    Store.sair().then(function () { D = null; desenhar(); });
  }

  function telaEntrar() {
    if (COM_BANCO && Store.entrarDireto) return telaEntrarDireto();
    var msg = h("p", { class: "apoio", style: "margin-top:12px" });
    var email = h("input", { type: "email", id: "email", placeholder: "voce@email.com", autocomplete: "email", inputmode: "email" });
    var btn = h("button", { class: "btn", type: "submit" }, COM_BANCO ? "Receber link" : "Entrar no demo");
    var form = h("form", { on: { submit: function (e) {
      e.preventDefault();
      var v = email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) { msg.textContent = "Digite um e-mail válido."; return; }
      btn.disabled = true;
      Store.entrar(v).then(function () {
        if (COM_BANCO) { msg.textContent = "Pronto. Abra o link que enviamos para " + v + " (confira o spam)."; }
        else { return iniciar().then(function () { ir("hoje"); }); }
      }).catch(function (er) { msg.textContent = "Não deu: " + er.message; }).then(function () { btn.disabled = false; });
    } } },
      h("label", { for: "email" }, "Seu e-mail"), email, btn, msg);
    app.appendChild(h("div", { class: "hero" },
      h("div", { class: "assina", style: "margin-bottom:22px" }, "APEX45"),
      trilhaVazia(),
      h("h1", {}, h("b", {}, "45 dias."), " ", h("span", {}, "Hábito que continua depois.")),
      h("p", { class: "apoio", style: "margin-top:14px" }, "Marque o que você fez, lance o número e veja o grupo andar junto."),
      form,
      COM_BANCO ? null : h("div", { class: "faixa" }, h("b", {}, "Modo demo. "), "Nada é enviado e nada sai do seu aparelho. Qualquer e-mail funciona. O ranking vem com pontos simulados.")));
  }

  function telaSemDesafio() {
    if (COM_BANCO && Store.entrarComCodigo && !modoAdmin()) {
      var conv = D && D.temConvite && !D.erroConvite;
      app.appendChild(h("div", { class: "hero" },
        h("div", { class: "assina", style: "margin-bottom:22px" }, "APEX45"),
        h("h1", {}, conv ? "Falta 1 toque." : "Você ainda não está no desafio."),
        D && D.erroConvite ? h("p", { class: "erro", style: "margin-top:12px" }, "O convite não abriu: " + D.erroConvite + ". Peça o link de novo no grupo.") : null,
        h("p", { class: "apoio", style: "margin-top:12px" }, conv ? "Primeira vez? Toque em Entrar no desafio. Já participa? Use seu código." : "Abra pelo link que o grupo mandou, ou use seu código."),
        conv ? botaoEntrarNoDesafio() : null,
        caixaCodigo(conv ? "Já participa? Use seu código" : "Seu código de acesso"),
        h("button", { class: "btn sec", on: { click: sairComAviso } }, "Sair")));
      return;
    }
    var nome = h("input", { value: "APEX45" });
    var ini = h("input", { type: "date", value: "2026-11-25" }), fim = h("input", { type: "date", value: "2027-01-08" });
    var erro = h("p", { class: "erro" });
    app.appendChild(topo());
    app.appendChild(h("div", { class: "hero" }, h("h1", {}, "Você ainda não está em um desafio."),
      D && D.erroConvite ? h("p", { class: "erro", style: "margin-top:12px" }, "O convite não abriu: " + D.erroConvite + ". Peça o link de novo a quem criou o desafio.") : null,
      h("p", { class: "apoio", style: "margin-top:12px" }, "Peça o link de convite a quem criou o desafio. Se você é quem cria, preencha abaixo."),
      h("label", {}, "Nome"), nome, h("div", { class: "dois" }, h("div", {}, h("label", {}, "Início"), ini), h("div", {}, h("label", {}, "Fim"), fim)),
      h("button", { class: "btn", on: { click: function (ev) {
        var b = ev.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = "Criando...";
        Store.criarDesafio(nome.value, ini.value, fim.value).then(function () { return iniciar(); }).then(function () { ir("metas"); desenhar(); })
          .catch(function (e) { erro.textContent = e.message; b.disabled = false; b.textContent = "Criar desafio"; });
      } } }, "Criar desafio"), erro,
      COM_BANCO && Store.entrarComCodigo ? caixaCodigo() : null,
      h("button", { class: "btn sec", on: { click: sairComAviso } }, "Sair")));
  }

  // ---------- 2. Metas individuais ----------
  function telaMetas(primeiro) {
    var me = D.me || {}, d = D.desafio;
    var diasNoDesafio = me.entrou_em ? R.diffDays(me.entrou_em, D.hoje) : 0;
    var travado = !primeiro && diasNoDesafio >= 3;
    var inds = (me.metas_individuais || []).slice();
    var nome = h("input", { value: me.nome || "", placeholder: "Como o grupo vai ver você", maxlength: 40 });
    var digital = h("input", { type: "checkbox", checked: me.e_digital ? true : null });
    var reels = h("input", { type: "number", min: 0, max: 200, value: me.meta_reels != null ? me.meta_reels : 40, inputmode: "numeric" });
    var dormir = h("input", { type: "time", value: me.dormir_alvo || "22:00" }), acordar = h("input", { type: "time", value: me.acordar_alvo || "06:00" });
    var agua = h("input", { type: "number", min: 3, max: 8, step: 0.5, value: Math.max(3, me.meta_agua_l || 3), inputmode: "decimal" });
    var habitoTxt = me.mau_habito || HABITO_PADRAO;
    var bloco = [nome, digital, reels, dormir, acordar, agua];
    if (travado) bloco.forEach(function (x) { if (x !== nome) x.disabled = true; });
    var boxInd = h("div", {});
    var novo = h("input", { placeholder: "Ex.: meditação", maxlength: 40 });
    function pintaInd() {
      limpar(boxInd);
      inds.forEach(function (n, i) {
        boxInd.appendChild(h("span", { class: "tag" }, n, travado ? null : h("button", { type: "button", "aria-label": "Remover " + n, on: { click: function () { inds.splice(i, 1); pintaInd(); } } }, "×")));
      });
      if (!inds.length) boxInd.appendChild(h("p", { class: "apoio" }, "Nenhuma ainda. É opcional."));
    }
    function add(n) { n = (n || "").trim(); if (n && inds.indexOf(n) < 0 && inds.length < 5) { inds.push(n); pintaInd(); } }
    pintaInd();
    var sug = h("div", { class: "lista-sug" }, ["Meditação", "Filosofia", "Alongamento", "Sol da manhã"].map(function (s) {
      return h("button", { type: "button", disabled: travado ? true : null, on: { click: function () { add(s); } } }, "+ " + s);
    }));
    var erro = h("p", { class: "erro" });
    var form = h("form", { on: { submit: function (e) {
      e.preventDefault();
      if (!nome.value.trim()) { erro.textContent = "Escreva seu nome."; return; }
      if (+agua.value < 3) { erro.textContent = "A meta de água não pode ser menor que 3 L (regra do grupo)."; return; }
      var p = { nome: nome.value.trim(), e_digital: digital.checked, meta_reels: digital.checked ? Math.max(0, +reels.value || 0) : 0,
        dormir_alvo: dormir.value, acordar_alvo: acordar.value, meta_agua_l: Math.max(3, +agua.value || 3), mau_habito: habitoTxt, metas_individuais: inds };
      tentar(Store.salvarPerfil(p)).then(iniciar).then(function () { toast("Metas salvas"); ir("hoje"); }).catch(function () {});
    } } },
      h("label", {}, "Seu nome"), nome,
      h("label", { class: "check" }, digital, "Eu crio conteúdo digital (reels)"),
      h("div", { id: "boxReels" }, h("label", {}, "Meta de reels no desafio ", h("span", { class: "opc" }, "(padrão 40; 0 = não participo)")), reels),
      h("div", { class: "dois" }, h("div", {}, h("label", {}, "Dormir às"), dormir), h("div", {}, h("label", {}, "Acordar às"), acordar)),
      h("p", { class: "apoio" }, "Mínimo de 7 h entre os dois. O app aceita até 30 min de diferença do horário (tolerância sugerida, o grupo pode mudar)."),
      h("label", {}, "Meta de água (litros) ", h("span", { class: "opc" }, "mínimo 3")), agua,
      h("label", {}, "Hábito que o grupo corta"), h("p", { class: "apoio" }, "Doces e industrializados (regra do card, vale pra todos)."),
      h("label", {}, "Minhas metas individuais ", h("span", { class: "opc" }, "(até 5)")), boxInd, sug,
      travado ? null : h("div", { class: "dois" }, novo, h("button", { type: "button", class: "btn sec", style: "margin-top:0", on: { click: function () { add(novo.value); novo.value = ""; } } }, "Adicionar")),
      travado ? h("div", { class: "faixa" }, h("b", {}, "Metas travadas. "), "Depois do 3º dia ninguém baixa a meta no meio do desafio (regra sugerida). Só o nome muda.") : null,
      h("button", { class: "btn", type: "submit" }, primeiro ? "Começar o desafio" : "Salvar"), erro);
    function mostraReels() { form.querySelector("#boxReels").style.display = digital.checked ? "" : "none"; }
    digital.addEventListener("change", mostraReels); mostraReels();
    app.appendChild(topo());
    app.appendChild(h("h1", { style: "margin-top:14px" }, primeiro ? "Escolha suas metas" : "Minhas metas"));
    app.appendChild(h("p", { class: "apoio", style: "margin-top:6px" }, "As metas do card (sono, treino, leitura, água, alimentação, espiritual) valem para todos. Aqui você ajusta as suas."));
    if (primeiro) { var cc = cartaoCodigo(); if (cc) app.appendChild(cc); }
    app.appendChild(form);
    if (!primeiro) { app.appendChild(h("button", { class: "btn sec", on: { click: function () { ir("hoje"); } } }, "Voltar")); app.appendChild(navegacao("metas")); }
    else if (COM_BANCO && Store.entrarComCodigo && !D.admin) app.appendChild(caixaCodigo("Não é sua primeira vez? Use seu código (volta seus pontos)"));
  }

  // ---------- 2b. Entrada em conversa (25/11 noite, pedido do Wallace) ----------
  // No lugar do formulario: o app pergunta, a pessoa responde, o app reage. Grava o mesmo perfil de telaMetas.
  var conv = null; // { i: passo atual, r: respostas, eco: o que a pessoa "falou" em cada passo } - sobrevive a redesenho
  function telaConversa() {
    var me = D.me || {};
    if (!conv) conv = { i: 0, r: {}, eco: [] };
    var r = conv.r;
    var log = h("div", { class: "conv-log", role: "log", "aria-live": "polite" }), comp = h("div", { class: "conv-comp" }), rod = h("div", { class: "conv-rod" });
    app.appendChild(topo());
    app.appendChild(h("div", { class: "conv" }, log, comp, rod));
    function rola() {
      if (!log.parentNode || !document.body.contains(log)) return;
      var alvo = document.documentElement.scrollHeight;
      try { window.scrollTo({ top: alvo, behavior: REDUZ ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, alvo); }
    }
    function bolha(quem, c) { var b = h("div", { class: "bolha " + quem }, c); log.appendChild(b); rola(); return b; }
    function fala(msgs, rapido, entao) {
      var k = 0;
      (function prox() {
        if (k >= msgs.length) return entao();
        var m = msgs[k++];
        if (rapido || REDUZ) { bolha("bot", m); return prox(); }
        var dg = bolha("bot dig", [h("i", {}), h("i", {}), h("i", {})]);
        setTimeout(function () { if (dg.parentNode) dg.parentNode.removeChild(dg); bolha("bot", m); prox(); }, 520);
      })();
    }
    function responder(chave, valor, eco) {
      r[chave] = valor; conv.eco[conv.i] = eco;
      limpar(comp); bolha("eu", eco); vibra(8);
      conv.i++; avanca(false);
    }
    function rap(ops) { // respostas prontas: tocar ja responde
      return h("div", { class: "conv-rap" }, ops.map(function (o) { return h("button", { type: "button", on: { click: function () { responder(o[0], o[1], o[2]); } } }, o[2]); }));
    }
    function linha(inp, ler, rapidas) { // campo + enviar
      var erro = h("p", { class: "erro" });
      return h("form", { novalidate: true, on: { submit: function (e) {
        e.preventDefault(); var x = ler(); if (x.erro) { erro.textContent = x.erro; return; } responder(x.k, x.v, x.eco);
      } } }, rapidas || null, h("div", { class: "conv-linha" }, inp, h("button", { class: "btn conv-env", type: "submit" }, "Enviar")), erro);
    }
    var SUG = ["Meditação", "Filosofia", "Alongamento", "Sol da manhã"];
    var P = [
      { bot: function () { return ["Bem-vindo ao APEX45. São 45 dias marcando o que você fez, com o grupo andando junto.", "Antes do dia 1, umas perguntas rápidas. Leva 1 minuto. Como o grupo vai te chamar?"]; },
        campo: function () {
          var i = h("input", { placeholder: "Seu nome", maxlength: 40, autocomplete: "given-name", "aria-label": "Seu nome", value: r.nome || "" });
          return linha(i, function () { var v = i.value.trim(); return v ? { k: "nome", v: v, eco: v } : { erro: "Escreva seu nome." }; });
        } },
      { bot: function () { return ["Prazer, " + primeiroNome(r.nome) + ".", "O sono vale ponto: no mínimo 7 h, no horário que você combinar aqui. Que horas você vai dormir?"]; },
        campo: function () {
          var i = h("input", { type: "time", "aria-label": "Hora de dormir", value: r.dormir || me.dormir_alvo || "22:00" });
          return linha(i, function () { return i.value ? { k: "dormir", v: i.value, eco: i.value } : { erro: "Escolha a hora." }; },
            rap(["21:30", "22:00", "22:30", "23:00"].map(function (t) { return ["dormir", t, t]; })));
        } },
      { bot: function () { return ["E acorda que horas?"]; },
        campo: function () {
          var i = h("input", { type: "time", "aria-label": "Hora de acordar", value: r.acordar || me.acordar_alvo || "06:00" });
          return linha(i, function () { return i.value ? { k: "acordar", v: i.value, eco: i.value } : { erro: "Escolha a hora." }; },
            rap(["05:00", "05:30", "06:00", "06:30"].map(function (t) { return ["acordar", t, t]; })));
        } },
      { bot: function () {
          var hh = R.sleepHours(r.dormir, r.acordar), base = "De " + r.dormir + " a " + r.acordar + " dá " + num1(hh) + " h";
          return [hh >= 7 ? base + " de sono. Fechado." : base + ". O grupo pede no mínimo 7 h pro sono valer inteiro. Dá pra ajustar no fim, em Refazer as respostas.",
            "Água: o mínimo do grupo é 3 L por dia. Qual vai ser a sua meta?"];
        },
        campo: function () {
          var i = h("input", { type: "number", min: 3, max: 8, step: "any", inputmode: "decimal", placeholder: "Outro valor, em litros", "aria-label": "Meta de água em litros" });
          return linha(i, function () {
            var v = lerNum(i); if (i.value === "") return { erro: "Escolha ou digite os litros." };
            if (v < 3) return { erro: "A meta de água não pode ser menor que 3 L (regra do grupo)." };
            if (v > 8) return { erro: "No máximo 8 L." };
            return { k: "agua", v: v, eco: num1(v) + " L" };
          }, rap([3, 3.5, 4, 5].map(function (n) { return ["agua", n, num1(n) + " L"]; })));
        } },
      { bot: function () { return [num1(r.agua) + " L por dia. Anotado.", "Você cria conteúdo digital? Quem posta reels ganha ponto por reel postado."]; },
        campo: function () { return rap([["digital", true, "Sim, eu posto reels"], ["digital", false, "Não"]]); } },
      { pula: function () { return !r.digital; },
        bot: function () { return ["Qual a sua meta de reels nos 45 dias? O padrão do grupo é 40."]; },
        campo: function () {
          var i = h("input", { type: "number", min: 0, max: 200, inputmode: "numeric", placeholder: "Outro número (0 = não participo)", "aria-label": "Meta de reels" });
          return linha(i, function () {
            if (i.value === "") return { erro: "Escolha ou digite a meta." };
            var v = Math.max(0, Math.min(200, Math.round(lerNum(i)))); return { k: "reels", v: v, eco: v + " reels" };
          }, rap([20, 30, 40, 60].map(function (n) { return ["reels", n, n + " reels"]; })));
        } },
      { bot: function () {
          return [r.digital ? (r.reels > 0 ? r.reels + " reels em 45 dias. Boa." : "Sem meta de reels, então.") : "Tranquilo, reels fica de fora pra você.",
            "Última: quer metas só suas, além das do grupo? Até 5. Toque nas sugestões ou escreva a sua."];
        },
        campo: function () {
          var inds = (r.inds || me.metas_individuais || []).slice();
          var caixa = h("div", { class: "conv-rap" }), novo = h("input", { placeholder: "Ex.: meditação", maxlength: 40, "aria-label": "Nova meta individual" });
          var pronto = h("button", { class: "btn", type: "button", style: "margin-top:10px", on: { click: function () { responder("inds", inds, inds.length ? inds.join(", ") : "Sem metas individuais"); } } });
          function troca(n) {
            var ix = inds.indexOf(n);
            if (ix >= 0) inds.splice(ix, 1); else if (inds.length >= 5) { toast("No máximo 5 metas individuais."); return; } else inds.push(n);
            pinta(); vibra(8);
          }
          function pinta() {
            limpar(caixa);
            SUG.concat(inds.filter(function (n) { return SUG.indexOf(n) < 0; })).forEach(function (n) {
              var on = inds.indexOf(n) >= 0;
              caixa.appendChild(h("button", { type: "button", class: on ? "on" : "", "aria-pressed": on ? "true" : "false", on: { click: function () { troca(n); } } }, n));
            });
            pronto.textContent = inds.length ? "Pronto (" + inds.length + ")" : "Pular";
          }
          pinta();
          return h("div", {}, caixa, h("form", { novalidate: true, class: "conv-linha", on: { submit: function (e) {
            e.preventDefault(); var n = novo.value.trim(); if (!n) return; novo.value = ""; if (inds.indexOf(n) < 0) troca(n);
          } } }, novo, h("button", { class: "btn sec conv-env", type: "submit" }, "Adicionar")), pronto);
        } },
      { bot: function () {
          function li(rot, val) { return h("div", {}, rot + " ", h("span", {}, val)); }
          var msgs = [h("div", { class: "conv-res" }, h("b", {}, "Suas metas, " + primeiroNome(r.nome)),
            li("Sono", r.dormir + " a " + r.acordar), li("Água", num1(r.agua) + " L por dia"),
            li("Reels", r.digital && r.reels > 0 ? r.reels + " nos 45 dias" : "fora"),
            li("Individuais", (r.inds || []).length ? r.inds.join(", ") : "nenhuma"),
            h("div", { style: "margin-top:8px" }, "Treino, leitura, alimentação e espiritual são as do card, iguais pra todos."))];
          if (me.codigo_acesso) msgs.push(h("div", {}, "Seu código de acesso:", h("b", { class: "mono conv-cod" }, me.codigo_acesso), "Tire um print. É com ele que você volta em outro celular.",
            h("button", { class: "btn sec", type: "button", on: { click: function () { copiar(me.codigo_acesso, "Código copiado"); } } }, "Copiar código")));
          msgs.push("Depois do 3º dia as metas travam: ninguém baixa a meta no meio do desafio. Tudo certo?");
          return msgs;
        },
        campo: function () {
          var erro = h("p", { class: "erro" });
          var b = h("button", { class: "btn", type: "button", style: "margin-top:0", on: { click: function () {
            b.disabled = true; b.textContent = "Salvando…"; erro.textContent = "";
            var p = { nome: r.nome, e_digital: !!r.digital, meta_reels: r.digital ? Math.max(0, +r.reels || 0) : 0, dormir_alvo: r.dormir, acordar_alvo: r.acordar,
              meta_agua_l: Math.max(3, +r.agua || 3), mau_habito: me.mau_habito || HABITO_PADRAO, metas_individuais: r.inds || [] };
            Store.salvarPerfil(p).then(iniciar).then(function () { conv = null; toast("Metas salvas. Bora pro dia 1."); ir("hoje"); })
              .catch(function (e) { erro.textContent = "Não salvou: " + (e && e.message ? e.message : e); b.disabled = false; b.textContent = "Começar o desafio"; });
          } } }, "Começar o desafio");
          return h("div", {}, b, h("button", { class: "btn sec", type: "button", style: "margin-top:8px", on: { click: function () { conv = { i: 0, r: r, eco: [] }; desenhar(); } } }, "Refazer as respostas"), erro);
        } }
    ];
    function avanca(rapido) {
      while (P[conv.i].pula && P[conv.i].pula()) conv.i++;
      var p = P[conv.i];
      limpar(comp); rod.style.display = conv.i === 0 ? "" : "none";
      fala(p.bot(), rapido, function () { limpar(comp); comp.appendChild(p.campo()); rola(); });
    }
    if (COM_BANCO && Store.entrarComCodigo && !D.admin) {
      var lk = h("button", { class: "link", type: "button", on: { click: function () { limpar(rod); rod.appendChild(caixaCodigo("Já participa? Digite seu código (volta seus pontos)")); rola(); } } }, "Já participo, tenho código");
      rod.appendChild(lk);
    }
    // redesenho no meio da conversa: recoloca o que ja foi dito, sem esperar
    for (var j = 0; j < conv.i; j++) if (conv.eco[j] != null) { P[j].bot().forEach(function (m) { bolha("bot", m); }); bolha("eu", conv.eco[j]); }
    avanca(conv.i > 0);
  }

  // ---------- mapa dos dias ----------
  var ROT_ESTADO = { futuro: "ainda não chegou", fora: "antes de você entrar", vazio: "sem lançamento", hoje: "hoje, ainda sem lançamento", salvo: "salvo pela versão mínima", forte: "90% ou mais das metas", bom: "70% ou mais das metas", fraco: "menos de 70% das metas" };
  function estadoDia(iso) {
    var d = D.desafio, ini = (D.me && D.me.entrou_em) || d.data_inicio;
    if (iso > D.hoje) return "futuro";
    var di = D.res.dias[iso];
    if (!di || !di.lancou) return iso === D.hoje ? "hoje" : iso < ini ? "fora" : "vazio";
    if (di.salvoPeloMinimo) return "salvo";
    var a = di.possivel ? (di.pontosBase || 0) / di.possivel : 0;
    return a >= 0.9 ? "forte" : a >= 0.7 ? "bom" : "fraco";
  }
  function trilha(grade) { // faixa de tracinhos (Hoje) ou grade clicavel (Meu total)
    var d = D.desafio, tot = R.diaDoDesafio(d, D.hoje).total, cs = [];
    for (var i = 0; i < tot; i++) (function (i) {
      var iso = R.addDays(d.data_inicio, i), st = estadoDia(iso), cls = st + (iso === D.hoje ? " agora" : "");
      if (!grade) { cs.push(h("i", { class: cls })); return; }
      cs.push(h("button", { type: "button", class: "cel " + cls, "aria-label": "Dia " + (i + 1) + ", " + dataBR(iso) + ": " + ROT_ESTADO[st], disabled: st === "futuro" ? true : null,
        on: { click: function () { abrirDia(iso, i + 1); } } }, h("span", { class: "mono" }, i + 1)));
    })(i);
    if (grade) return h("div", { class: "grade45" }, cs);
    return h("a", { class: "trilha", href: "#/total", "aria-label": "Mapa dos " + tot + " dias. Abrir Meu total" }, cs);
  }
  function abrirDia(iso, n) {
    var d = D.desafio, ini = (D.me && D.me.entrou_em) || d.data_inicio, di = D.res.dias[iso], corpo = h("div", {}), fechar;
    if (!di || !di.lancou) corpo.appendChild(h("p", { class: "apoio", style: "margin:8px 0" }, iso < ini ? "Você ainda não tinha entrado no desafio." : "Nada lançado neste dia."));
    else {
      corpo.appendChild(h("div", { class: "dia-res" }, h("b", { class: "mono" }, di.pontos || 0), " pontos de " + (di.possivel || 0) + " possíveis" + (di.salvoPeloMinimo ? " · salvo pela versão mínima" : "")));
      Object.keys(di.itens).forEach(function (k) {
        var it = di.itens[k], id = k.split(":")[0], nome = id === "individual" ? k.slice(11) : (NOME_META[id] || k);
        corpo.appendChild(h("div", { class: "meta estatica" + (it.bateu ? " bateu" : it.minimo ? " minimo" : " parcial") },
          icone(it.bateu ? "check" : id), h("div", { class: "corpo" }, h("div", { class: "nome" }, nome), h("div", { class: "sub" }, detalhe(id, it) || (it.bateu ? "Feito" : ""))),
          h("div", { class: "pt" }, it.pontos ? "+" + it.pontos : it.bateu ? "ok" : "não bateu")));
      });
    }
    var ontem = R.addDays(D.hoje, -1);
    if (iso === D.hoje || (iso === ontem && iso >= ini && iso >= d.data_inicio)) corpo.appendChild(h("button", { class: "btn", type: "button", on: { click: function () {
      estado.dia = iso === D.hoje ? "hoje" : "ontem"; fechar(); if (rota() === "hoje") desenhar(); else ir("hoje");
    } } }, "Lançar neste dia"));
    fechar = folha("Dia " + n + " · " + nomeDia(iso) + ", " + dataBR(iso), corpo);
  }

  // ---------- 3. Hoje ----------
  function telaHoje(el) {
    var d = D.desafio, me = D.me, res = D.res, hoje = D.hoje;
    var pos = R.diaDoDesafio(d, hoje);
    var ontem = R.addDays(hoje, -1);
    var podeOntem = ontem >= d.data_inicio && ontem <= d.data_fim && ontem >= (me.entrou_em || d.data_inicio);
    var data = estado.dia === "ontem" && podeOntem ? ontem : hoje;
    if (!podeOntem) estado.dia = "hoje";
    var dentro = data >= d.data_inicio && data <= d.data_fim;

    var diP = res.dias[data] || {}, anel = null;
    if (dentro) { // anel do dia: enche conforme os pontos entram
      var frac = diP.possivel ? Math.min(1, (diP.pontosBase || 0) / diP.possivel) : 0, CIRC = 2 * Math.PI * 52;
      anel = h("div", { class: "anel" + (frac >= 1 ? " cheio" : ""), role: "progressbar", "aria-label": "Pontos do dia", "aria-valuenow": diP.pontosBase || 0, "aria-valuemax": diP.possivel || 0 });
      anel.innerHTML = '<svg viewBox="0 0 120 120"><defs><linearGradient id="gAnel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B1A"/><stop offset="1" stop-color="#E8430A"/></linearGradient></defs><circle class="trilho" cx="60" cy="60" r="52"/><circle class="arco" cx="60" cy="60" r="52" stroke-dasharray="' + CIRC.toFixed(1) + '"/></svg>';
      var arco = anel.querySelector(".arco"), deF = vistos["anel" + data] == null ? 0 : vistos["anel" + data]; vistos["anel" + data] = frac;
      arco.style.strokeDashoffset = (CIRC * (1 - (REDUZ ? frac : deF))).toFixed(1);
      if (!REDUZ) depois(function () { arco.style.strokeDashoffset = (CIRC * (1 - frac)).toFixed(1); });
      anel.appendChild(h("div", { class: "anel-c" }, conta(h("b", { class: "mono" }), "ptsDia" + data, diP.pontos || 0), h("span", {}, "de " + (diP.possivel || 0) + " pontos")));
    }
    el.appendChild(h("div", { class: "dia" + (dentro ? " com-anel" : "") }, anel,
      h("div", { class: "dia-txt" },
        h("div", { class: "apoio" }, nomeDia(data) + ", " + dataBR(data)),
        pos.antes ? h("div", { class: "big" }, "Começa em " + (1 - pos.n) + " dia(s)") :
        pos.depois ? h("div", { class: "big" }, "Encerrado") :
        h("div", { class: "big" }, "Dia " + (R.diaDoDesafio(d, data).n), h("span", {}, " de " + pos.total)),
        dentro ? h("div", { class: "seq" + (res.sequencia > 0 ? " on" : "") }, icone("chama"), h("b", { class: "mono" }, res.sequencia), res.sequencia === 1 ? " dia de sequência" : " dias de sequência") : null)));

    if (podeOntem) el.appendChild(h("div", { class: "chips" },
      ["hoje", "ontem"].map(function (k) { return h("button", { class: "chip" + (estado.dia === k ? " on" : ""), on: { click: function () { estado.dia = k; desenhar(); } } }, k === "hoje" ? "Hoje" : "Ontem"); })));

    if (!dentro) { el.appendChild(h("div", { class: "faixa" }, pos.antes ? "O desafio ainda não começou." : "O desafio terminou. Veja seu resultado em Meu total.")); return; }

    var di = res.dias[data] || { pontos: 0, possivel: 0, aprov: 0, itens: {}, metas: {}, lancou: false, dow: R.dow(data), treinoFalta: false };
    var dw = R.dow(data);
    // dia sem lancamento ainda nao esta em res.dias se anterior a entrada; calcula possivel basico
    el.appendChild(trilha(false));

    // funcao 2: cobranca do grupo (so no dia de hoje)
    if (data === hoje) { var cardDupla = blocoDupla(di); if (cardDupla) el.appendChild(cardDupla); }

    // faixa de dia
    var W = res.semanas[R.weekStart(data)] || { musc: 0, cardio: 0 };
    var cont = "Musculação " + Math.min(W.musc, 3) + "/3 · Cardio " + Math.min(W.cardio, 2) + "/2 nesta semana";
    if (dw === 6) el.appendChild(h("div", { class: "faixa" }, h("b", {}, "Descanso ativo. "), "Caminhada na orla, bike, esporte, sair de casa. ", cont));
    else if (dw === 0) el.appendChild(h("div", { class: "faixa" }, h("b", {}, di.treinoFalta ? "Reposição. " : "Folga. "), di.treinoFalta ? "Falta " + reposicaoTexto(W) + ". Pode repor hoje." : "Descanso total, sem treino faltando."));
    else el.appendChild(h("div", { class: "faixa" }, cont));

    // falta lancar
    var ids = ["sono", "leitura", "agua", "alimentacao", "devocional"];
    var faltam = [];
    ids.forEach(function (i) { if (!di.itens[i]) faltam.push(NOME_META[i].toLowerCase()); });
    if (di.metas.treino && !di.itens.treino) faltam.push("treino");
    var faltamIds = ids.filter(function (i) { return !di.itens[i]; }); if (di.metas.treino && !di.itens.treino) faltamIds.push("treino");
    if (data === hoje && faltam.length) el.appendChild(h("div", { class: "card destaque falta" }, h("b", {}, "Falta lançar"), h("span", { class: "apoio" }, " · toque pra marcar"),
      h("div", { class: "lista-sug" }, faltamIds.map(function (i) { return h("button", { type: "button", on: { click: function () { abrirJanela(i, data, null); } } }, icone(i), NOME_META[i]); }))));
    else if (data === hoje && di.lancou && !faltam.length) el.appendChild(h("div", { class: "card" }, h("b", {}, "Tudo lançado hoje."), " Boa."));

    // funcao 1: dia ruim (versao minima)
    var ruim = !!estado.diaRuim;
    if (di.salvoPeloMinimo) {
      el.appendChild(h("div", { class: "card minimo-card" }, h("b", {}, "Dia salvo pela versão mínima. "), "Valeu metade dos pontos e a sequência continua."));
    } else {
      el.appendChild(h("button", { class: "card minimo-card toggle" + (ruim ? " on" : ""), "aria-expanded": ruim ? "true" : "false", on: { click: function () { estado.diaRuim = !estado.diaRuim; desenhar(); } } },
        h("div", { class: "linha-tog" }, h("b", {}, "Dia ruim? Faça a versão mínima."), h("span", { class: "seta" }, ruim ? "fechar" : "ver")),
        h("div", { class: "apoio" }, "Vale metade dos pontos e segura a sequência. Nunca falhe dois dias seguidos."),
        ruim ? h("div", { class: "lista-min" }, ["sono", "treino", "leitura", "agua", "alimentacao", "devocional"].map(function (k) {
          return h("span", {}, h("b", {}, NOME_META[k]), " " + MINIMO_TXT[k]);
        })) : null));
    }

    el.appendChild(h("h2", {}, "Metas do dia"));
    function linhaMeta(id, nome, sub, opts) {
      opts = opts || {};
      var it = di.itens[id];
      var cls = "meta" + (it ? (it.bateu ? " bateu" : it.minimo ? " minimo" : " parcial") : "") + (opts.travado ? " travado" : "");
      var pt = it ? (it.bateu ? (it.pontos ? "+" + it.pontos : "ok") : it.minimo ? "+" + it.pontos + " mínimo" : "lançado, não bateu") : "pendente";
      if (!it && ruim && MINIMO_TXT[id] && !opts.travado) sub = "Mínimo de hoje: " + MINIMO_TXT[id];
      var det = it ? detalhe(id, it) : sub;
      return h("button", { class: cls, disabled: opts.travado ? true : null, on: { click: function () { if (!opts.travado) abrirJanela(id, data, it); } } },
        icone(it && it.bateu ? "check" : id),
        h("div", { class: "corpo" }, h("div", { class: "nome" }, nome), h("div", { class: "sub" }, det)),
        h("div", { class: "pt" + (it ? "" : " vazio") }, pt));
    }
    var travadoTreino = dw === 0 && !di.treinoFalta;
    el.appendChild(linhaMeta("sono", "Sono", "Mínimo 7 h · alvo " + me.dormir_alvo + " a " + me.acordar_alvo));
    el.appendChild(linhaMeta("treino", "Treino", travadoTreino ? "Folga hoje" : dw === 6 ? "Descanso ativo" : dw === 0 ? "Reposição" : "Musculação ou cardio", { travado: travadoTreino }));
    el.appendChild(linhaMeta("leitura", "Leitura", "20 páginas · Hábitos Atômicos"));
    el.appendChild(linhaMeta("agua", "Água", "Mínimo " + num1(Math.max(3, me.meta_agua_l || 3)) + " L"));
    el.appendChild(linhaMeta("alimentacao", "Alimentação", "3 refeições · sem " + (me.mau_habito || HABITO_PADRAO)));
    el.appendChild(linhaMeta("devocional", "Espiritual", "Devocional no app da Bíblia"));
    if (di.metas.culto) {
      var itC = di.itens.culto;
      el.appendChild(h("button", { class: "meta" + (itC && itC.bateu ? " bateu" : ""), on: { click: function (ev) {
        ev.currentTarget.classList.add("indo");
        var antesC = D.res.total;
        var p = itC && itC.bateu ? Store.removerCheckin(data, "culto") : Store.salvarCheckin({ data: data, meta: "culto", valor: 1, extra: {} });
        tentar(p).then(recarregar).then(function () { desenhar(); var g = D.res.total - antesC; if (g > 0) { festa("+" + g); toast("+" + g + " pontos"); } }).catch(function () { desenhar(); });
      } } }, icone(itC && itC.bateu ? "check" : "culto"), h("div", { class: "corpo" }, h("div", { class: "nome" }, "Culto de domingo"), h("div", { class: "sub" }, "Espiritual · toque para marcar")),
        h("div", { class: "pt" + (itC && itC.bateu ? "" : " vazio") }, itC && itC.bateu ? "+" + itC.pontos : "pendente")));
    }
    (me.metas_individuais || []).forEach(function (n) {
      var k = "individual:" + n, it = di.itens[k];
      el.appendChild(h("button", { class: "meta" + (it && it.bateu ? " bateu" : ""), on: { click: function (ev) {
        ev.currentTarget.classList.add("indo");
        var antesI = D.res.total;
        var p = it && it.bateu ? Store.removerCheckin(data, k) : Store.salvarCheckin({ data: data, meta: "individual", valor: 1, extra: { nome: n } });
        tentar(p).then(recarregar).then(function () { desenhar(); var g = D.res.total - antesI; if (g > 0) festa("+" + g); else if (!(it && it.bateu)) vibra(15); }).catch(function () { desenhar(); });
      } } }, icone(it && it.bateu ? "check" : "individual"), h("div", { class: "corpo" }, h("div", { class: "nome" }, n), h("div", { class: "sub" }, "Meta individual · toque para marcar")),
        h("div", { class: "pt" + (it && it.bateu ? "" : " vazio") }, it && it.bateu ? "feito" : "pendente")));
    });
    if (me.e_digital && me.meta_reels > 0) {
      var tot = res.totais.reels, it = di.itens.reels;
      el.appendChild(h("button", { class: "meta" + (it && it.bateu ? " bateu" : ""), on: { click: function () { abrirJanela("reels", data, it); } } },
        icone(it && it.bateu ? "check" : "reels"), h("div", { class: "corpo" }, h("div", { class: "nome" }, "Reels"), h("div", { class: "sub" }, it ? it.valor + " postado(s) neste dia" : "Total " + tot + " de " + me.meta_reels)),
        h("div", { class: "pt" + (it ? "" : " vazio") }, it ? "+" + (di.pontosReels || 0) : "pendente")));
    }
    el.appendChild(h("p", { class: "apoio", style: "margin-top:14px" }, "Você pode editar hoje e ontem. Depois disso o dia fecha."));
    if (D.modo === "demo" && Store.erroSalvar()) el.appendChild(h("p", { class: "erro" }, "O navegador não deixou salvar: " + Store.erroSalvar()));
  }
  function reposicaoTexto(W) {
    var f = []; if (W.musc < 3) f.push((3 - W.musc) + " musculação"); if (W.cardio < 2) f.push((2 - W.cardio) + " cardio"); return f.join(" e ");
  }
  /* 25/11 ~18h (ordem do Wallace): sem dupla, a cobranca e do GRUPO TODO. Depois da hora, quem abre o app
     ve todo mundo que ainda nao marcou e tem 1 botao pra cobrar no WhatsApp (escolhe o grupo e envia). */
  function blocoDupla(di) {
    var hora = D.desafio.cobranca_hora || "21:00", agora = agoraHHMM(), passou = agora >= hora;
    var faltam = D.placar.filter(function (p) { return !p.eu && !p.lancouHoje; }).map(function (p) { return primeiroNome(p.nome); });
    function lista(ns) { return ns.length > 1 ? ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1] : ns[0]; }
    if (passou && faltam.length) {
      var msg = "São " + agora + " e o APEX45 ainda tá esperando o check de hoje de " + lista(faltam) + ". Bora, nem que seja a versão mínima.";
      return h("div", { class: "card dupla alerta" },
        h("div", { class: "rot" }, "Cobrança do grupo"),
        h("div", { class: "tit" }, agora + " e " + lista(faltam) + (faltam.length > 1 ? " ainda não marcaram" : " ainda não marcou") + " nada hoje."),
        h("p", { class: "apoio" }, "Combinado do grupo: quem não marca até as " + hora + " é cobrado." + (di.lancou ? "" : " Você também ainda não marcou.")),
        h("a", { class: "btn", href: "https://wa.me/?text=" + encodeURIComponent(msg), target: "_blank", rel: "noopener" }, "Cobrar no grupo do WhatsApp"));
    }
    if (passou && !di.lancou) {
      return h("div", { class: "card dupla alerta" }, h("div", { class: "rot" }, "Cobrança do grupo"),
        h("div", { class: "tit" }, "Já são " + agora + ". O grupo está vendo que você não marcou hoje."),
        h("p", { class: "apoio" }, "Marca nem que seja a versão mínima."));
    }
    var ja = D.placar.filter(function (p) { return p.lancouHoje; }).length;
    return h("div", { class: "dupla-linha" }, h("span", { class: "rot" }, "Grupo"), " " + ja + " de " + D.placar.length + " já marcaram hoje · às " + hora + " o app cobra quem faltar");
  }
  function detalhe(id, it) {
    var x = it.extra || {};
    if (id === "sono") return "Dormiu " + x.dormir + ", acordou " + x.acordar + " (" + num1(x._horas != null ? x._horas : R.sleepHours(x.dormir, x.acordar)) + " h)";
    if (id === "treino") {
      if (x.tipo === "minimo") return "Versão mínima, " + (x.minutos || it.valor) + " min de movimento";
      return ({ musculacao: "Musculação", cardio: "Cardio", descanso_ativo: "Descanso ativo" }[x.tipo] || "Treino") + ", " + (x.minutos || it.valor) + " min" + (it.bateu ? "" : " (passou do plano da semana)");
    }
    if (id === "leitura") return it.valor + " páginas" + (x.livro ? " de " + x.livro : "");
    if (id === "agua") return num1(it.valor) + " L";
    if (id === "alimentacao") return it.valor + " refeições" + (x.cortou ? " · sem doces e industrializados" : "");
    if (id === "devocional") return x.minimo ? "Versão mínima: 1 oração curta" : x.nota ? x.nota : "Devocional feito";
    if (id === "reels") return it.valor + " postado(s)";
    return "";
  }

  // janela de lancamento
  function abrirJanela(id, data, existente) {
    var me = D.me, x = (existente && existente.extra) || {};
    var campos = [], salvar;
    var dw = R.dow(data);
    var titulo = NOME_META[id];
    var erro = h("p", { class: "erro" });
    if (id === "sono") {
      var dor = h("input", { type: "time", value: x.dormir || me.dormir_alvo || "22:00" }), aco = h("input", { type: "time", value: x.acordar || me.acordar_alvo || "06:00" });
      var calc = h("p", { class: "calc" });
      var atual = function () {
        var hh = R.sleepHours(dor.value, aco.value), ok = R.sonoBate(dor.value, aco.value, me, R.REGRA);
        calc.className = "calc " + (ok ? "ok" : hh >= R.REGRA.minimo.sonoHoras ? "meio" : "ruim");
        calc.textContent = "Total: " + num1(hh) + " h" + (ok ? " (bate)" : hh >= R.REGRA.minimo.sonoHoras ? (hh < 7 ? " (abaixo de 7 h: vale a versão mínima)" : " (fora do horário: vale a versão mínima)") : " (abaixo de 6 h, não pontua)");
      };
      dor.addEventListener("input", atual); aco.addEventListener("input", atual); atual();
      campos = [h("div", { class: "dois" }, h("div", {}, h("label", {}, "Fui dormir"), dor), h("div", {}, h("label", {}, "Acordei"), aco)), calc];
      salvar = function () { return { data: data, meta: "sono", valor: R.sleepHours(dor.value, aco.value), extra: { dormir: dor.value, acordar: aco.value } }; };
    } else if (id === "treino") {
      var ops = dw === 6 ? [["descanso_ativo", "Descanso ativo"], ["musculacao", "Musculação"], ["cardio", "Cardio"]] :
        dw === 0 ? [["musculacao", "Reposição de musculação"], ["cardio", "Reposição de cardio"]] : [["musculacao", "Musculação"], ["cardio", "Cardio (esporte conta)"]];
      ops = ops.concat([["minimo", "Dia ruim: 10 min de movimento"]]);
      var tipoIni = x.tipo || (estado.diaRuim ? "minimo" : ops[0][0]);
      if (!ops.some(function (o) { return o[0] === tipoIni; })) tipoIni = ops[0][0];
      var tipo = segmento(ops, tipoIni, true);
      var min = h("input", { type: "number", min: 1, max: 400, inputmode: "numeric", value: x.minutos || "", placeholder: "Ex.: 50" });
      campos = [h("label", {}, "Tipo"), tipo.el, h("label", {}, "Minutos"), min, atalhos(min, [20, 30, 45, 60, 90], " min"),
        h("p", { class: "apoio", style: "margin-top:8px" }, "A versão mínima vale metade e segura a sequência, mas não conta no plano da semana (3 musculação, 2 cardio).")];
      salvar = function () {
        var m = +min.value; if (!(m > 0)) { erro.textContent = "Digite os minutos."; return null; }
        if (tipo.value === "minimo" && m < R.REGRA.minimo.treinoMin) { erro.textContent = "A versão mínima é de pelo menos " + R.REGRA.minimo.treinoMin + " min."; return null; }
        return { data: data, meta: "treino", valor: m, extra: { tipo: tipo.value, minutos: m } };
      };
    } else if (id === "leitura") {
      var pg = h("input", { type: "number", min: 0, max: 500, inputmode: "numeric", value: existente ? existente.valor : "", placeholder: "Meta: 20 · mínimo: 5" }), liv = h("input", { value: existente ? (x.livro || "") : "Hábitos Atômicos", placeholder: "Opcional" });
      campos = [h("label", {}, "Páginas lidas"), pg, passos(pg, [5, 10, 20]), medidor(pg, 20, "páginas", 5), h("label", {}, "Livro ", h("span", { class: "opc" }, "(opcional)")), liv];
      salvar = function () { if (pg.value === "") { erro.textContent = "Digite as páginas."; return null; } return { data: data, meta: "leitura", valor: +pg.value, extra: { livro: liv.value.trim() } }; };
    } else if (id === "agua") {
      var l = h("input", { type: "number", min: 0, max: 10, step: "any", inputmode: "decimal", value: existente ? existente.valor : "", placeholder: "Meta: " + num1(Math.max(3, me.meta_agua_l || 3)) + " · mínimo: 2" });
      campos = [h("label", {}, "Litros"), l, passos(l, [0.25, 0.5, 1], true), medidor(l, Math.max(3, me.meta_agua_l || 3), "L", 2)];
      salvar = function () { if (l.value === "") { erro.textContent = "Digite os litros."; return null; } return { data: data, meta: "agua", valor: +String(l.value).replace(",", "."), extra: {} }; };
    } else if (id === "alimentacao") {
      var ref = segmento([[0, "0"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5+"]], existente ? Math.min(5, +existente.valor || 0) : null);
      var cortou = h("input", { type: "checkbox", checked: x.cortou ? true : null });
      campos = [h("label", {}, "Quantas refeições? ", h("span", { class: "opc" }, "meta 3 · mínimo 2")), ref.el, h("label", { class: "check" }, cortou, "Hoje sem " + (me.mau_habito || HABITO_PADRAO))];
      salvar = function () { if (ref.value == null) { erro.textContent = "Escolha quantas refeições."; return null; } return { data: data, meta: "alimentacao", valor: existente && +existente.valor > 5 && ref.value === 5 ? +existente.valor : ref.value, extra: { cortou: cortou.checked } }; };
    } else if (id === "devocional") {
      var nota = h("textarea", { placeholder: "O que você leu ou refletiu (opcional)" }); nota.value = x.nota || "";
      var versao = segmento([["cheio", "Devocional completo (app da Bíblia)"], ["minimo", "Dia ruim: 1 oração curta (vale metade)"]], x.minimo || (estado.diaRuim && !existente) ? "minimo" : "cheio", true);
      campos = [h("p", { class: "apoio" }, "Devocional diário no app da Bíblia. Domingo tem o culto, que conta à parte."), h("label", {}, "O que você fez"), versao.el,
        h("label", {}, "Nota ", h("span", { class: "opc" }, "(opcional)")), nota];
      salvar = function () { var e = { nota: nota.value.trim() }; if (versao.value === "minimo") e.minimo = true; return { data: data, meta: "devocional", valor: 1, extra: e }; };
    } else if (id === "reels") {
      var q = h("input", { type: "number", min: 0, max: 20, inputmode: "numeric", value: existente ? existente.valor : "", placeholder: "Quantos postou" });
      campos = [h("label", {}, "Reels postados neste dia"), q, passos(q, [1]), h("p", { class: "apoio", style: "margin-top:8px" }, "2 pontos por reel, até 3 por dia.")];
      salvar = function () { if (q.value === "") { erro.textContent = "Digite a quantidade."; return null; } return { data: data, meta: "reels", valor: +q.value, extra: {} }; };
    }
    var fundo = h("div", { class: "fundo", role: "dialog", "aria-modal": "true", "aria-label": titulo, on: { click: function (e) { if (e.target === fundo) fechar(); } } });
    function fechar() { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") fechar(); }
    document.addEventListener("keydown", esc);
    var bSalvar = h("button", { class: "btn", type: "submit" }, "Salvar e somar pontos");
    var janela = h("form", { class: "janela", novalidate: true, tabindex: "-1", on: { submit: function (e) {
      e.preventDefault(); erro.textContent = "";
      if (bSalvar.disabled) return;
      var c = salvar(); if (!c) return;
      var antes = D.res ? D.res.total : 0, dA = (D.res && D.res.dias[data]) || {};
      var salvoAntes = !!dA.salvoPeloMinimo, cheioAntes = !!(dA.possivel && (dA.pontosBase || 0) >= dA.possivel);
      bSalvar.disabled = true; bSalvar.textContent = "Salvando…";
      tentar(Store.salvarCheckin(c)).then(recarregar).then(function () {
        fechar(); desenhar();
        var gan = D.res.total - antes, dd = D.res.dias[data] || {};
        if (dd.salvoPeloMinimo && !salvoAntes) { estado.diaRuim = false; desenhar(); vibra([20, 40, 30]); toast("Dia salvo. A sequência continua."); return; }
        var itNovo = dd.itens && dd.itens[R.chave(c)];
        var fechou = !!(dd.possivel && (dd.pontosBase || 0) >= dd.possivel) && !cheioAntes;
        if (gan > 0) festa("+" + gan, fechou);
        toast(fechou ? "Dia fechado: 100% das metas." : gan > 0 ? "+" + gan + " pontos" + (itNovo && itNovo.minimo ? " (versão mínima)" : "") : "Lançado. Esta meta ainda não bateu.");
      }).catch(function () { bSalvar.disabled = false; bSalvar.textContent = "Salvar e somar pontos"; });
    } } },
      h("div", { class: "pega" }),
      h("h3", {}, titulo + " · " + (data === D.hoje ? "hoje" : "ontem")),
      campos, erro,
      bSalvar,
      existente ? h("button", { class: "btn perigo", type: "button", on: { click: function () {
        tentar(Store.removerCheckin(data, id)).then(recarregar).then(function () { fechar(); desenhar(); }).catch(function () {});
      } } }, "Remover lançamento") : null,
      h("button", { class: "btn sec", type: "button", on: { click: fechar } }, "Cancelar"));
    fundo.appendChild(janela); document.body.appendChild(fundo);
    try { janela.focus({ preventScroll: true }); } catch (e) { janela.focus(); } // foco na janela: o teclado so sobe quando a pessoa toca no campo
  }

  // ---------- 4. Grupo ----------
  function telaGrupo(el) {
    var abas = [["total", "Total"], ["hoje", "Hoje"], ["semana", "Semana"]];
    el.appendChild(h("h1", { style: "margin-top:14px" }, "Grupo"));
    el.appendChild(h("p", { class: "apoio", style: "margin-top:4px" }, "Só pontos e sequência. Ninguém vê os números de saúde dos outros."));
    el.appendChild(h("div", { class: "abas", role: "tablist" }, abas.map(function (a) {
      return h("button", { role: "tab", class: estado.aba === a[0] ? "on" : "", "aria-selected": estado.aba === a[0] ? "true" : "false", on: { click: function () { estado.aba = a[0]; desenhar(); } } }, a[1]);
    })));
    var lista = D.placar.slice();
    if (estado.aba === "semana") lista.sort(function (a, b) { return b.pontosSemana - a.pontosSemana; });
    if (estado.aba === "hoje") lista.sort(function (a, b) { return (b.lancouHoje ? 1 : 0) - (a.lancouHoje ? 1 : 0) || b.total - a.total; });
    var aba = estado.aba, ehHoje = aba === "hoje";
    function ptsDe(p) { return aba === "semana" ? p.pontosSemana : p.total; }
    if (ehHoje) {
      var ja = lista.filter(function (p) { return p.lancouHoje; }).length;
      el.appendChild(h("div", { class: "card hg" },
        h("div", { class: "hg-n" }, h("b", { class: "mono" }, ja), " de " + lista.length + (ja === 1 ? " já marcou hoje" : " já marcaram hoje")),
        h("div", { class: "hg-seg", "aria-hidden": "true" }, lista.map(function (p) { return h("i", { class: p.lancouHoje ? "on" : "" }); }))));
    } else {
      var lider = lista.length ? ptsDe(lista[0]) : 0;
      // podio: so quando tem 3 ou mais e alguem ja pontuou
      if (lista.length >= 3 && lider > 0) {
        el.appendChild(h("div", { class: "podio" }, [1, 0, 2].map(function (ix) {
          var p = lista[ix];
          return h("div", { class: "deg p" + (ix + 1) + (p.eu ? " eu" : "") },
            h("div", { class: "avatar" }, iniciais(p.nome)),
            h("div", { class: "deg-nome" }, primeiroNome(p.nome)),
            h("div", { class: "deg-pts mono" }, ptsDe(p)),
            h("div", { class: "deg-base mono" }, ix + 1));
        })));
      }
      // quanto falta pra passar quem esta na frente
      var euIx = -1; lista.forEach(function (p, i) { if (p.eu) euIx = i; });
      if (euIx === 0 && lista.length > 1 && lider > 0) el.appendChild(h("div", { class: "passar" }, h("b", {}, "Você lidera o grupo."), " " + (ptsDe(lista[0]) - ptsDe(lista[1])) + " pontos na frente de " + primeiroNome(lista[1].nome) + "."));
      else if (euIx > 0) {
        var falta = ptsDe(lista[euIx - 1]) - ptsDe(lista[euIx]);
        el.appendChild(h("div", { class: "passar" }, falta > 0 ? [h("b", { class: "mono" }, falta), (falta === 1 ? " ponto" : " pontos") + " pra passar " + primeiroNome(lista[euIx - 1].nome) + "."] : "Empatado com " + primeiroNome(lista[euIx - 1].nome) + ". O próximo ponto te coloca na frente."));
      }
    }
    var topoPts = Math.max.apply(null, lista.map(ptsDe).concat([1]));
    lista.forEach(function (p, i) {
      var sub = ehHoje ? (p.lancouHoje ? "Já lançou hoje" : "Ainda não lançou") : "Sequência " + p.sequencia + (p.sequencia === 1 ? " dia" : " dias") + " · aproveitamento " + pct(p.aproveitamento);
      el.appendChild(h("div", { class: "rank" + (p.eu ? " eu" : "") },
        ehHoje ? h("div", { class: "status" + (p.lancouHoje ? " ok" : "") }, p.lancouHoje ? icone("check") : null) : h("div", { class: "pos mono" }, i + 1),
        h("div", { class: "avatar peq" }, iniciais(p.nome)),
        h("div", { class: "corpo" }, h("div", { class: "nome" }, p.nome + (p.eu ? " (você)" : "")), h("div", { class: "sub" }, sub),
          ehHoje ? null : h("div", { class: "rank-barra" }, cresce(h("i", {}), "width", "rk:" + aba + ":" + p.id, Math.round((ptsDe(p) / topoPts) * 100)))),
        h("div", { class: "pts mono" }, ptsDe(p))));
    });
    if (!gravando() && D.placar.some(function (p) { return p.exemplo; })) el.appendChild(h("div", { class: "faixa" }, h("b", {}, "Pontos simulados. "), "Os pontos dos outros aqui são simulados até o app ir pro ar com banco. Os seus são reais."));
    el.appendChild(h("p", { class: "apoio", style: "margin-top:10px" }, "O aproveitamento aparece ao lado dos pontos para quem tem menos metas possíveis (por exemplo, quem não é do digital) não ficar atrás só por regra."));
  }

  // ---------- 5. Meu total ----------
  function telaTotal(el) {
    var t = D.res.totais, me = D.me, res = D.res, d = D.desafio;
    var horasTreino = (t.minMusc + t.minCardio) / 60;
    var mediaSono = t.sonoDias ? t.sonoHoras / t.sonoDias : 0;
    el.appendChild(h("h1", { style: "margin-top:14px" }, "Meu total"));
    el.appendChild(h("div", { class: "card destaque" }, h("div", { class: "apoio" }, "Pontos"), conta(h("div", { class: "big mono placar" }), "total", res.total),
      h("div", { class: "apoio" }, res.pontosDias + " dos dias + " + res.pontosBonus + " de bônus · melhor sequência " + res.melhorSequencia + (res.melhorSequencia === 1 ? " dia" : " dias") +
        (t.diasSalvos ? " · " + t.diasSalvos + (t.diasSalvos === 1 ? " dia salvo" : " dias salvos") + " pela versão mínima" : ""))));

    // mapa dos 45 dias: toque num dia pra ver o que foi lancado
    el.appendChild(h("h2", {}, "Mapa dos 45 dias"));
    el.appendChild(h("div", { class: "card" }, trilha(true),
      h("div", { class: "leg" }, [["forte", "Dia cheio"], ["bom", "Bom"], ["fraco", "Fraco"], ["salvo", "Salvo pelo mínimo"], ["vazio", "Sem lançar"]].map(function (o) { return h("span", {}, h("i", { class: o[0] }), o[1]); }))));

    // funcao 3: painel de equilibrio da semana
    el.appendChild(painelEquilibrio());
    function stat(n, unid, l) { if (unid === "dias" && n === 1) unid = "dia"; return h("div", { class: "stat" }, h("div", { class: "n mono" }, n, unid ? h("small", {}, " " + unid) : null), h("div", { class: "l" }, l)); }
    el.appendChild(h("div", { class: "grid2" },
      stat(t.paginas, "pág", "Páginas lidas"),
      stat(num1(horasTreino), "h", "Treino (" + t.nMusc + " musculação, " + t.nCardio + " cardio" + (t.nDescanso ? ", " + t.nDescanso + " descanso ativo" : "") + ")"),
      stat(t.sonoDias ? num1(mediaSono) : "0", "h", "Sono médio (" + t.sonoNoHorario + (t.sonoNoHorario === 1 ? " noite" : " noites") + " no horário)"),
      stat(num1(t.agua), "L", "Água em " + t.aguaDias + (t.aguaDias === 1 ? " dia" : " dias")),
      me.e_digital && me.meta_reels > 0 ? stat(t.reels, "de " + me.meta_reels, "Reels") : stat(t.devocional, "dias", "Devocional"),
      stat(me.e_digital && me.meta_reels > 0 ? t.devocional : t.habito, "dias", me.e_digital && me.meta_reels > 0 ? "Devocional" : "Mau hábito cortado"),
      me.e_digital && me.meta_reels > 0 ? stat(t.habito, "dias", "Mau hábito cortado") : stat(t.individuais, "dias", "Metas individuais"),
      me.e_digital && me.meta_reels > 0 ? stat(t.individuais, "dias", "Metas individuais") : stat(pct(res.aproveitamento), "", "Aproveitamento")));

    // grafico semanal
    var semanas = Object.keys(res.semanas).sort();
    if (semanas.length) {
      var vals = semanas.map(function (w) { return R.pontosSemana(res, w); }), max = Math.max.apply(null, vals.concat([1]));
      var atual = R.weekStart(D.hoje);
      el.appendChild(h("h2", {}, "Pontos por semana"));
      el.appendChild(h("div", { class: "card" }, h("div", { class: "barras", role: "img", "aria-label": "Pontos por semana: " + vals.join(", ") },
        semanas.map(function (w, i) { return h("div", { class: "b" + (w === atual ? " atual" : "") }, h("span", { class: "mono" }, vals[i]), cresce(h("i", {}), "height", "sem:" + w, Math.max(2, Math.round((vals[i] / max) * 90)), "px"), h("span", {}, dataBR(w))); }))));
    }

    // bonus
    if (res.bonus.length) {
      el.appendChild(h("h2", {}, "Bônus ganhos"));
      res.bonus.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }).forEach(function (b) {
        el.appendChild(h("div", { class: "rank" }, h("div", { class: "corpo" }, h("div", { class: "nome" }, b.label), h("div", { class: "sub" }, "Semana de " + dataBR(b.data))), h("div", { class: "pts mono" }, "+" + b.pontos)));
      });
    }

    // fotos
    el.appendChild(h("h2", {}, "Antes e depois"));
    var boxFotos = h("div", { class: "fotos" });
    ["antes", "depois"].forEach(function (tipo) {
      var cx = h("div", { class: "foto" }, tipo === "antes" ? "Foto de antes" : "Foto de depois");
      var v = D.fotos[tipo];
      if (v) Store.fotoUrl(v).then(function (u) { if (u) { limpar(cx); cx.appendChild(h("img", { src: u, alt: "Foto " + tipo })); } });
      var inp = h("input", { type: "file", accept: "image/*", "aria-label": "Enviar foto de " + tipo, style: "margin-top:8px" });
      inp.addEventListener("change", function () {
        if (!inp.files[0]) return;
        reduzir(inp.files[0]).then(function (url) { return tentar(Store.salvarFoto(tipo, url)); }).then(recarregar).then(function () { desenhar(); toast("Foto salva"); }).catch(function () {});
      });
      boxFotos.appendChild(h("div", {}, cx, inp));
    });
    el.appendChild(boxFotos);
    el.appendChild(h("label", { class: "check" }, h("input", { type: "checkbox", checked: D.fotos.visivel ? true : null, on: { change: function (e) { Store.fotoVisivel(e.target.checked).then(function () { D.fotos.visivel = e.target.checked; }); } } }), "Mostrar minhas fotos para o grupo"));
    el.appendChild(h("p", { class: "apoio" }, "Por padrão as fotos são só suas. Foto de antes na semana 1, de depois na última."));

    // pagina final
    var fim = R.diaDoDesafio(d, D.hoje);
    el.appendChild(h("h2", {}, fim.depois ? "Página final" : "Página final (prévia)"));
    el.appendChild(h("div", { class: "final" }, "Em " + Math.max(0, Math.min(fim.n, fim.total)) + (Math.min(fim.n, fim.total) === 1 ? " dia" : " dias") + " eu treinei ", h("b", {}, num1(horasTreino) + (num1(horasTreino) === "1" ? " hora" : " horas")), ", li ", h("b", {}, t.paginas + " páginas"),
      ", dormi em média ", h("b", {}, num1(mediaSono) + " h"), " por noite e bebi ", h("b", {}, num1(t.agua) + " litros"), " de água.", me.e_digital && me.meta_reels > 0 ? " Postei " + t.reels + " reels." : ""));
    var nDias = Math.max(0, Math.min(fim.n, fim.total));
    var resumo = "APEX45 · dia " + nDias + " de " + fim.total + "\n" + res.total + " pontos · sequência de " + res.sequencia + (res.sequencia === 1 ? " dia" : " dias") + "\nTreino: " + num1(horasTreino) + " h · Leitura: " + t.paginas + " páginas · Água: " + num1(t.agua) + " L";
    el.appendChild(h("button", { class: "btn sec", type: "button", on: { click: function () {
      if (navigator.share) navigator.share({ text: resumo }).catch(function () {});
      else copiar(resumo, "Resultado copiado. Cole no grupo.");
    } } }, "Compartilhar meu resultado"));
  }

  /* Painel de equilibrio (25/11): barras horizontais, 1 serie, valor escrito na barra.
     A area que ficou pra tras vai em laranja; as outras em cinza neutro. */
  function painelEquilibrio() {
    var d = D.desafio, atual = R.weekStart(D.hoje), passada = R.addDays(atual, -7);
    var temPassada = passada >= R.weekStart(d.data_inicio) && passada >= R.weekStart(D.me.entrou_em || d.data_inicio);
    if (estado.eqSemana === "passada" && !temPassada) estado.eqSemana = "atual";
    var wk = estado.eqSemana === "passada" ? passada : atual;
    var fimWk = R.addDays(wk, 6), ate = fimWk < D.hoje ? fimWk : D.hoje;
    var E = R.equilibrio(D.res, D.me, d, wk, ate);
    var box = h("div", {});
    box.appendChild(h("h2", {}, "Equilíbrio da semana"));
    if (temPassada) box.appendChild(h("div", { class: "chips", style: "margin-top:0" }, [["atual", "Esta semana"], ["passada", "Semana passada"]].map(function (o) {
      return h("button", { class: "chip" + ((estado.eqSemana || "atual") === o[0] ? " on" : ""), on: { click: function () { estado.eqSemana = o[0]; desenhar(); } } }, o[1]);
    })));
    if (!E.dias || !E.areas.length) { box.appendChild(h("div", { class: "card vazio" }, "Lance o primeiro dia da semana pra ver o equilíbrio.")); return box; }
    var desc = E.areas.map(function (a) { return a.nome + " " + pct(a.pct); }).join(", ");
    box.appendChild(h("div", { class: "card eq", role: "img", "aria-label": "Equilíbrio da semana: " + desc },
      E.areas.map(function (a) {
        var atras = E.atras && E.atras.id === a.id;
        return h("div", { class: "eq-linha" + (atras ? " atras" : ""), title: a.nome + ": " + pct(a.pct) },
          h("span", { class: "eq-nome" }, a.nome),
          h("span", { class: "eq-trilho" }, cresce(h("i", {}), "width", "eq:" + wk + a.id, Math.max(2, Math.round(a.pct * 100)))),
          h("span", { class: "eq-val mono" }, pct(a.pct)));
      }),
      h("p", { class: "eq-leg" }, E.atras ? [h("b", {}, "Ficou pra trás: " + E.atras.nome + " (" + pct(E.atras.pct) + ")."), " É ela que pede atenção " + (wk === atual ? "no resto da semana." : "nesta semana.")]
        : [h("b", {}, "Semana equilibrada."), " Todas as áreas em 100%."]),
      h("p", { class: "apoio", style: "font-size:12px;margin-top:4px" }, E.dias + (E.dias === 1 ? " dia contado" : " dias contados") + ". Versão mínima conta metade.")));
    return box;
  }

  function reduzir(file) {
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.75));
        };
        img.onerror = function () { no(new Error("Não consegui abrir essa imagem.")); }; img.src = fr.result;
      };
      fr.onerror = function () { no(new Error("Não consegui ler o arquivo.")); }; fr.readAsDataURL(file);
    });
  }

  // ---------- 6. Semana (quiz) ----------
  function telaSemana(el) {
    var d = D.desafio, j = R.janelaQuiz(d, D.hoje);
    var feito = D.quizzes.filter(function (q) { return q.semana === j.semana; })[0];
    el.appendChild(h("h1", { style: "margin-top:14px" }, "Semana"));
    el.appendChild(h("p", { class: "apoio", style: "margin-top:4px" }, "Reunião do grupo: " + nomeDia(j.reuniao) + " " + dataBR(j.reuniao) + (d.reuniao_hora ? ", " + d.reuniao_hora : "") + (d.reuniao_confirmada ? "" : " (dia e hora a confirmar)") + ". O quiz abre 2 dias antes."));
    if (!j.aberto) { el.appendChild(h("div", { class: "card" }, "O quiz abre em " + nomeDia(j.abre) + ", " + dataBR(j.abre) + ".")); }
    else if (feito) { el.appendChild(h("div", { class: "card destaque" }, h("b", {}, "Quiz respondido. "), "+10 pontos. Obrigado.")); }
    else {
      var dif = null, erro = h("p", { class: "erro" });
      var opts = [["muito_facil", "Muito fácil"], ["ok", "Tranquila"], ["dificil", "Difícil"], ["muito_dificil", "Muito difícil"]];
      var radios = opts.map(function (o) { return h("label", { class: "check" }, h("input", { type: "radio", name: "dif", value: o[0], on: { change: function () { dif = o[0]; } } }), o[1]); });
      var trav = h("select", {}, h("option", { value: "" }, "Nenhuma travou"), CATALOGO.map(function (c) { return h("option", { value: c.id }, c.nome); }), D.me.e_digital ? h("option", { value: "reels" }, "Reels") : null, (D.me.metas_individuais || []).length ? h("option", { value: "individual" }, "Meta individual") : null);
      var onde = h("textarea", { maxlength: 280, placeholder: "Curto: o que atrapalhou" }), muda = h("textarea", { maxlength: 280, placeholder: "Curto: o que você muda" });
      el.appendChild(h("form", { class: "card", on: { submit: function (e) {
        e.preventDefault();
        if (!dif) { erro.textContent = "Escolha como foi a semana."; return; }
        tentar(Store.salvarQuiz({ semana: j.semana, dificuldade: dif, meta_travou: trav.value, onde_travou: onde.value.trim(), muda_semana: muda.value.trim() })).then(recarregar).then(function () { desenhar(); toast("+10 pontos pelo quiz"); }).catch(function () {});
      } } },
        h("h3", {}, "Como foi a semana?"), radios,
        h("label", {}, "Qual meta mais travou?"), trav,
        h("label", {}, "Onde travou?"), onde,
        h("label", {}, "O que muda na semana que vem?"), muda,
        h("button", { class: "btn", type: "submit" }, "Enviar (menos de 1 min)"), erro));
    }
    var rq = D.resumoQuiz;
    el.appendChild(h("h2", {}, "Resumo do grupo para a pauta"));
    if (!rq || !rq.total) el.appendChild(h("div", { class: "vazio" }, "Ainda sem respostas."));
    else {
      var rot = { muito_facil: "Muito fácil", ok: "Tranquila", dificil: "Difícil", muito_dificil: "Muito difícil" };
      Object.keys(rot).forEach(function (k) { el.appendChild(h("div", { class: "rank" }, h("div", { class: "corpo" }, h("div", { class: "nome" }, rot[k])), h("div", { class: "pts mono" }, rq.dificuldade[k] || 0))); });
      var tr = Object.keys(rq.travou || {}).sort(function (a, b) { return rq.travou[b] - rq.travou[a]; });
      if (tr.length) el.appendChild(h("p", { class: "apoio", style: "margin-top:10px" }, "Metas que mais travaram: " + tr.map(function (k) { return (NOME_META[k] || k) + " (" + rq.travou[k] + ")"; }).join(", ") + "."));
    }
    if (D.modo === "demo") el.appendChild(h("p", { class: "apoio", style: "margin-top:8px" }, "No demo só conta a sua resposta. Com o banco, entram as de todos, e os textos livres só o admin vê."));
  }

  // ---------- 7. Admin ----------
  function telaAdmin(el) {
    var d = D.desafio;
    el.appendChild(h("h1", { style: "margin-top:14px" }, "Admin"));
    var nome = h("input", { value: d.nome }), ini = h("input", { type: "date", value: d.data_inicio }), fim = h("input", { type: "date", value: d.data_fim });
    var conf = h("input", { type: "checkbox", checked: d.data_confirmada ? true : null });
    var rd = h("select", {}, NOMES_DIA.map(function (n, i) { return h("option", { value: i, selected: d.reuniao_dia === i ? true : null }, n); }));
    var rh = h("input", { type: "time", value: d.reuniao_hora || "20:00" });
    var rconf = h("input", { type: "checkbox", checked: d.reuniao_confirmada ? true : null });
    var pts = {}, P = Object.assign({}, R.PONTOS, (d.regras_json && d.regras_json.pontos) || {});
    var gridP = h("div", { class: "dois" }, ["sono", "leitura", "agua", "refeicoes", "habito", "devocional", "culto", "treino", "individual"].map(function (k) {
      pts[k] = h("input", { type: "number", min: 0, max: 100, value: P[k], inputmode: "numeric" });
      return h("div", {}, h("label", {}, ({ sono: "Sono", leitura: "Leitura", agua: "Água", refeicoes: "3 refeições", habito: "Sem doces e industrializados", devocional: "Devocional", culto: "Culto (domingo)", treino: "Treino", individual: "Individual" })[k]), pts[k]);
    }));
    var cob = h("input", { type: "time", value: d.cobranca_hora || "21:00" });
    var erro = h("p", { class: "erro" });
    el.appendChild(h("form", { class: "card", on: { submit: function (e) {
      e.preventDefault();
      if (fim.value < ini.value) { erro.textContent = "O fim não pode ser antes do início."; return; }
      var np = {}; Object.keys(pts).forEach(function (k) { np[k] = Math.max(0, +pts[k].value || 0); });
      var patch = { nome: nome.value.trim() || d.nome, data_inicio: ini.value, data_fim: fim.value, data_confirmada: conf.checked,
        reuniao_dia: +rd.value, reuniao_hora: rh.value, reuniao_confirmada: rconf.checked, cobranca_hora: cob.value || "21:00", regras_json: Object.assign({}, d.regras_json, { pontos: np }) };
      tentar(Store.salvarDesafio(patch)).then(recarregar).then(function () { desenhar(); toast("Desafio atualizado"); }).catch(function () {});
    } } },
      h("h3", {}, "Desafio"), h("label", {}, "Nome"), nome,
      h("div", { class: "dois" }, h("div", {}, h("label", {}, "Início"), ini), h("div", {}, h("label", {}, "Fim"), fim)),
      h("label", { class: "check" }, conf, "Datas confirmadas (tira o selo \"a confirmar\")"),
      h("p", { class: "apoio" }, "Ao mudar a data, o app recalcula o dia X de N, os marcos de sequência e a semana do quiz."),
      h("label", {}, "Reunião semanal"), h("div", { class: "dois" }, rd, rh),
      h("label", { class: "check" }, rconf, "Reunião confirmada"),
      h("label", {}, "Hora da cobrança do grupo"), cob,
      h("p", { class: "apoio" }, "Depois dessa hora, quem abre o app vê todo mundo que ainda não marcou e pode cobrar no grupo do WhatsApp."),
      h("h3", { style: "margin-top:18px" }, "Pontos por meta"), gridP,
      h("p", { class: "apoio", style: "margin-top:8px" }, "Valores sugeridos pelo Walla. A versão mínima (dia ruim) vale metade de cada meta. Mudar vale para todos e recalcula o placar."),
      h("button", { class: "btn", type: "submit" }, "Salvar"), erro));

    // convite e participantes
    var linkBox = h("p", { class: "apoio", style: "word-break:break-all;margin-top:10px" });
    el.appendChild(h("div", { class: "card" }, h("h3", {}, "Convite"), h("p", { class: "apoio" }, "Quem entra no meio começa com 0 pontos e a sequência nasce no 1º lançamento."),
      h("button", { class: "btn sec", on: { click: function () {
        Store.gerarConvite(d.codigo_convite).then(function (l) { linkBox.textContent = l; if (navigator.clipboard) navigator.clipboard.writeText(l).then(function () { toast("Link copiado"); }, function () {}); });
      } } }, "Gerar link de convite"), linkBox));
    var boxP = h("div", {});
    Store.participantes().then(function (ps) {
      ps.forEach(function (p) {
        boxP.appendChild(h("div", { class: "rank" }, h("div", { class: "corpo" }, h("div", { class: "nome" }, p.nome), p.exemplo ? h("div", { class: "sub" }, "Pontos simulados no demo") : null),
          (!p.exemplo && Store.removerParticipante && p.id !== D.me.id) ? h("button", { class: "chip", style: "flex:none", on: { click: function () { if (confirm("Remover " + p.nome + "?")) Store.removerParticipante(p.id).then(function () { return recarregar(); }).then(desenhar); } } }, "Remover") : null));
      });
    });
    el.appendChild(h("h2", {}, "Participantes")); el.appendChild(boxP);
    if (Store.acessosDoGrupo) {
      var boxC = h("div", {});
      el.appendChild(h("div", { class: "card" }, h("h3", {}, "Códigos de acesso"),
        h("p", { class: "apoio" }, "Só você vê. Se alguém trocar de celular e perder o código, mande o dele no privado."), boxC));
      Store.acessosDoGrupo().then(function (ls) {
        ls.forEach(function (x) { boxC.appendChild(h("div", { class: "rank" }, h("div", { class: "corpo" }, h("div", { class: "nome" }, x.nome)), h("div", { class: "mono", style: "letter-spacing:2px;font-weight:700" }, x.codigo))); });
      }, function (e) { boxC.appendChild(h("p", { class: "erro" }, e.message)); });
    }

    if (D.modo === "demo") {
      var sim = h("input", { type: "date", value: D.hoje });
      var simH = h("input", { type: "time", value: D.agora || "21:30" });
      el.appendChild(h("div", { class: "card" }, h("h3", {}, "Ferramentas do demo"),
        h("p", { class: "apoio" }, "Só para testar. Muda o \"hoje\" do app para ver sequência, bônus e semanas passando. Não existe no app com banco."),
        h("label", {}, "Simular que hoje é"), sim,
        h("button", { class: "btn sec", on: { click: function () { Store.setHoje(sim.value); recarregar().then(desenhar); } } }, "Aplicar data"),
        h("button", { class: "btn sec", on: { click: function () { Store.setHoje(null); recarregar().then(desenhar); } } }, "Voltar para a data real"),
        h("label", {}, "Simular que agora são"), simH,
        h("button", { class: "btn sec", on: { click: function () { Store.setHora(simH.value); recarregar().then(desenhar); toast("Hora simulada: " + simH.value); } } }, "Aplicar hora (testa a cobrança do grupo)"),
        h("button", { class: "btn sec", on: { click: function () { Store.setHora(null); recarregar().then(desenhar); } } }, "Voltar para a hora real"),
        h("button", { class: "btn sec", on: { click: function () { Store.preencherMeusDias().then(function (n) { return recarregar().then(function () { desenhar(); toast(n + " lançamentos criados até ontem"); }); }); } } }, "Preencher meus dias passados (pra gravar)"),
        h("label", { class: "check", style: "margin-top:16px" }, h("input", { type: "checkbox", checked: Store.gravacao() ? true : null, on: { change: function (e) { Store.setGravacao(e.target.checked); recarregar().then(desenhar); } } }),
          "Modo gravação: esconde os selos e avisos do demo pra gravar a tela"),
        h("button", { class: "btn perigo", on: { click: function () { if (confirm("Apagar todos os dados do demo neste navegador?")) { Store.reset(); D = null; location.hash = "#/"; iniciar().then(desenhar); } } } }, "Zerar o demo")));
    }
    el.appendChild(h("button", { class: "btn sec", on: { click: sairComAviso } }, "Sair"));
  }

  // ---------- boot ----------
  function carregarScript(src) {
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { no(new Error("Falha ao carregar " + src)); }; document.head.appendChild(s); });
  }
  function iniciar() {
    if (!Store.sessao()) { D = null; return Promise.resolve(); }
    return recarregar();
  }
  function boot() {
    carregarScript(COM_BANCO ? "js/store-supabase.js" : "js/store-demo.js").then(function () {
      Store = window.Store;
      return Store.init();
    }).then(iniciar).then(function () {
      if (!Store.sessao()) { if (rota()) ir(""); }
      else if (!rota()) ir("hoje");
      desenhar();
    }).catch(function (e) {
      limpar(app); app.appendChild(h("div", { class: "hero" }, h("h1", {}, "Algo não abriu"), h("p", { class: "erro" }, e.message),
        h("button", { class: "btn", on: { click: function () { location.reload(); } } }, "Tentar de novo"),
        Store && Store.sair ? h("button", { class: "btn sec", on: { click: function () { Store.sair().then(function () { location.href = location.pathname + location.search; }, function () { location.href = location.pathname + location.search; }); } } }, "Sair") : null));
    });
  }
  // voltou pro app (trocou de aba ou destravou o celular): busca os pontos novos do grupo
  var ultimaVolta = 0;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !Store || !Store.sessao || !Store.sessao() || !D) return;
    var r = rota(); if (r !== "hoje" && r !== "grupo") return;
    if (document.querySelector(".fundo") || Date.now() - ultimaVolta < 20000) return;
    ultimaVolta = Date.now();
    recarregar().then(function () { if (!document.querySelector(".fundo")) desenhar(); }).catch(function () {});
  });
  boot();
})();
