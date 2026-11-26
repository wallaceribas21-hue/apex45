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
    limpar(app);
    var sess = Store.sessao();
    var r = rota();
    if (!sess) { return telaEntrar(); }
    if (!D) { app.appendChild(h("p", { class: "apoio", style: "padding-top:40px" }, "Carregando...")); return; }
    if (D.semDesafio) return telaSemDesafio();
    if (!D.me || !D.me.nome) { if (r !== "metas") { ir("metas"); return; } return telaMetas(true); }
    var mapa = { hoje: telaHoje, grupo: telaGrupo, total: telaTotal, semana: telaSemana, admin: telaAdmin, metas: function () { telaMetas(false); } };
    var f = mapa[r];
    if (!f) { ir("hoje"); return; }
    app.appendChild(topo());
    var tela = h("div", {}); app.appendChild(tela);
    f(tela);
    if (r === "total") { var cc = cartaoCodigo(); if (cc) tela.appendChild(cc); if (COM_BANCO) tela.appendChild(h("button", { class: "btn sec", on: { click: sairComAviso } }, "Sair")); }
    app.appendChild(navegacao(r));
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
      return h("a", { href: "#/" + i[0], class: r === i[0] ? "on" : "", "aria-current": r === i[0] ? "page" : null }, i[1]);
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

  // ---------- 3. Hoje ----------
  function telaHoje(el) {
    var d = D.desafio, me = D.me, res = D.res, hoje = D.hoje;
    var pos = R.diaDoDesafio(d, hoje);
    var ontem = R.addDays(hoje, -1);
    var podeOntem = ontem >= d.data_inicio && ontem <= d.data_fim && ontem >= (me.entrou_em || d.data_inicio);
    var data = estado.dia === "ontem" && podeOntem ? ontem : hoje;
    if (!podeOntem) estado.dia = "hoje";
    var dentro = data >= d.data_inicio && data <= d.data_fim;

    el.appendChild(h("div", { class: "dia" },
      h("div", { class: "apoio" }, nomeDia(data) + ", " + dataBR(data)),
      pos.antes ? h("div", { class: "big" }, "Começa em " + (1 - pos.n) + " dia(s)") :
      pos.depois ? h("div", { class: "big" }, "Encerrado") :
      h("div", { class: "big" }, "Dia " + (R.diaDoDesafio(d, data).n), h("span", {}, " de " + pos.total))));

    if (podeOntem) el.appendChild(h("div", { class: "chips" },
      ["hoje", "ontem"].map(function (k) { return h("button", { class: "chip" + (estado.dia === k ? " on" : ""), on: { click: function () { estado.dia = k; desenhar(); } } }, k === "hoje" ? "Hoje" : "Ontem"); })));

    if (!dentro) { el.appendChild(h("div", { class: "faixa" }, pos.antes ? "O desafio ainda não começou." : "O desafio terminou. Veja seu resultado em Meu total.")); return; }

    var di = res.dias[data] || { pontos: 0, possivel: 0, aprov: 0, itens: {}, metas: {}, lancou: false, dow: R.dow(data), treinoFalta: false };
    var dw = R.dow(data);
    // dia sem lancamento ainda nao esta em res.dias se anterior a entrada; calcula possivel basico
    var possivel = di.possivel || 0;
    el.appendChild(h("div", { class: "barra", role: "progressbar", "aria-valuenow": di.pontosBase || 0, "aria-valuemax": possivel }, h("i", { style: "width:" + Math.min(100, possivel ? Math.round(((di.pontosBase || 0) / possivel) * 100) : 0) + "%" })));
    el.appendChild(h("div", { class: "linha-info" },
      h("span", {}, h("b", { class: "mono", style: "color:#fff" }, (di.pontos || 0)), " pontos de " + possivel + " possíveis"),
      h("span", {}, "Sequência: ", h("b", { style: "color:#fff" }, res.sequencia + (res.sequencia === 1 ? " dia" : " dias")))));

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
    if (data === hoje && faltam.length) el.appendChild(h("div", { class: "card destaque" }, h("b", {}, "Falta lançar: "), faltam.join(", ") + "."));
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
      el.appendChild(h("button", { class: "meta" + (itC && itC.bateu ? " bateu" : ""), on: { click: function () {
        var p = itC && itC.bateu ? Store.removerCheckin(data, "culto") : Store.salvarCheckin({ data: data, meta: "culto", valor: 1, extra: {} });
        tentar(p).then(recarregar).then(function () { desenhar(); if (!(itC && itC.bateu)) toast("+" + (D.res.P ? D.res.P.culto : 10) + " pontos"); }).catch(function () {});
      } } }, h("div", { class: "corpo" }, h("div", { class: "nome" }, "Culto de domingo"), h("div", { class: "sub" }, "Espiritual · toque para marcar")),
        h("div", { class: "pt" + (itC && itC.bateu ? "" : " vazio") }, itC && itC.bateu ? "+" + itC.pontos : "pendente")));
    }
    (me.metas_individuais || []).forEach(function (n) {
      var k = "individual:" + n, it = di.itens[k];
      el.appendChild(h("button", { class: "meta" + (it && it.bateu ? " bateu" : ""), on: { click: function () {
        var p = it && it.bateu ? Store.removerCheckin(data, k) : Store.salvarCheckin({ data: data, meta: "individual", valor: 1, extra: { nome: n } });
        tentar(p).then(recarregar).then(function () { desenhar(); }).catch(function () {});
      } } }, h("div", { class: "corpo" }, h("div", { class: "nome" }, n), h("div", { class: "sub" }, "Meta individual · toque para marcar")),
        h("div", { class: "pt" + (it && it.bateu ? "" : " vazio") }, it && it.bateu ? "feito" : "pendente")));
    });
    if (me.e_digital && me.meta_reels > 0) {
      var tot = res.totais.reels, it = di.itens.reels;
      el.appendChild(h("button", { class: "meta" + (it && it.bateu ? " bateu" : ""), on: { click: function () { abrirJanela("reels", data, it); } } },
        h("div", { class: "corpo" }, h("div", { class: "nome" }, "Reels"), h("div", { class: "sub" }, it ? it.valor + " postado(s) neste dia" : "Total " + tot + " de " + me.meta_reels)),
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
      var calc = h("p", { class: "apoio", style: "margin-top:8px" });
      var atual = function () {
        var hh = R.sleepHours(dor.value, aco.value), ok = R.sonoBate(dor.value, aco.value, me, R.REGRA);
        calc.textContent = "Total: " + num1(hh) + " h" + (ok ? " (bate)" : hh >= R.REGRA.minimo.sonoHoras ? (hh < 7 ? " (abaixo de 7 h: vale a versão mínima)" : " (fora do horário: vale a versão mínima)") : " (abaixo de 6 h, não pontua)");
      };
      dor.addEventListener("input", atual); aco.addEventListener("input", atual); atual();
      campos = [h("div", { class: "dois" }, h("div", {}, h("label", {}, "Fui dormir"), dor), h("div", {}, h("label", {}, "Acordei"), aco)), calc];
      salvar = function () { return { data: data, meta: "sono", valor: R.sleepHours(dor.value, aco.value), extra: { dormir: dor.value, acordar: aco.value } }; };
    } else if (id === "treino") {
      var ops = dw === 6 ? [["descanso_ativo", "Descanso ativo"], ["musculacao", "Musculação"], ["cardio", "Cardio"]] :
        dw === 0 ? [["musculacao", "Reposição de musculação"], ["cardio", "Reposição de cardio"]] : [["musculacao", "Musculação"], ["cardio", "Cardio (esporte conta)"]];
      ops = ops.concat([["minimo", "Dia ruim: 10 min de movimento"]]);
      var tipo = h("select", {}, ops.map(function (o) { return h("option", { value: o[0], selected: (x.tipo || (estado.diaRuim ? "minimo" : "")) === o[0] ? true : null }, o[1]); }));
      var min = h("input", { type: "number", min: 1, max: 400, inputmode: "numeric", value: x.minutos || "", placeholder: "Ex.: 50" });
      campos = [h("label", {}, "Tipo"), tipo, h("label", {}, "Minutos"), min,
        h("p", { class: "apoio", style: "margin-top:8px" }, "A versão mínima vale metade e segura a sequência, mas não conta no plano da semana (3 musculação, 2 cardio).")];
      salvar = function () {
        var m = +min.value; if (!(m > 0)) { erro.textContent = "Digite os minutos."; return null; }
        if (tipo.value === "minimo" && m < R.REGRA.minimo.treinoMin) { erro.textContent = "A versão mínima é de pelo menos " + R.REGRA.minimo.treinoMin + " min."; return null; }
        return { data: data, meta: "treino", valor: m, extra: { tipo: tipo.value, minutos: m } };
      };
    } else if (id === "leitura") {
      var pg = h("input", { type: "number", min: 0, max: 500, inputmode: "numeric", value: existente ? existente.valor : "", placeholder: "Meta: 20 · mínimo: 5" }), liv = h("input", { value: existente ? (x.livro || "") : "Hábitos Atômicos", placeholder: "Opcional" });
      campos = [h("label", {}, "Páginas lidas"), pg, h("label", {}, "Livro ", h("span", { class: "opc" }, "(opcional)")), liv];
      salvar = function () { if (pg.value === "") { erro.textContent = "Digite as páginas."; return null; } return { data: data, meta: "leitura", valor: +pg.value, extra: { livro: liv.value.trim() } }; };
    } else if (id === "agua") {
      var l = h("input", { type: "number", min: 0, max: 10, step: 0.1, inputmode: "decimal", value: existente ? existente.valor : "", placeholder: "Meta: " + num1(Math.max(3, me.meta_agua_l || 3)) + " · mínimo: 2" });
      campos = [h("label", {}, "Litros"), l];
      salvar = function () { if (l.value === "") { erro.textContent = "Digite os litros."; return null; } return { data: data, meta: "agua", valor: +String(l.value).replace(",", "."), extra: {} }; };
    } else if (id === "alimentacao") {
      var ref = h("input", { type: "number", min: 0, max: 10, inputmode: "numeric", value: existente ? existente.valor : "", placeholder: "Meta: 3 · mínimo: 2" });
      var cortou = h("input", { type: "checkbox", checked: x.cortou ? true : null });
      campos = [h("label", {}, "Quantas refeições?"), ref, h("label", { class: "check" }, cortou, "Hoje sem " + (me.mau_habito || HABITO_PADRAO))];
      salvar = function () { if (ref.value === "") { erro.textContent = "Digite as refeições."; return null; } return { data: data, meta: "alimentacao", valor: +ref.value, extra: { cortou: cortou.checked } }; };
    } else if (id === "devocional") {
      var nota = h("textarea", { placeholder: "O que você leu ou refletiu (opcional)" }); nota.value = x.nota || "";
      var versao = h("select", {}, h("option", { value: "cheio", selected: !x.minimo && !(estado.diaRuim && !existente) ? true : null }, "Devocional completo (app da Bíblia)"),
        h("option", { value: "minimo", selected: x.minimo || (estado.diaRuim && !existente) ? true : null }, "Dia ruim: 1 oração curta (vale metade)"));
      campos = [h("p", { class: "apoio" }, "Devocional diário no app da Bíblia. Domingo tem o culto, que conta à parte."), h("label", {}, "O que você fez"), versao,
        h("label", {}, "Nota ", h("span", { class: "opc" }, "(opcional)")), nota];
      salvar = function () { var e = { nota: nota.value.trim() }; if (versao.value === "minimo") e.minimo = true; return { data: data, meta: "devocional", valor: 1, extra: e }; };
    } else if (id === "reels") {
      var q = h("input", { type: "number", min: 0, max: 20, inputmode: "numeric", value: existente ? existente.valor : "", placeholder: "Quantos postou" });
      campos = [h("label", {}, "Reels postados neste dia"), q, h("p", { class: "apoio", style: "margin-top:8px" }, "2 pontos por reel, até 3 por dia.")];
      salvar = function () { if (q.value === "") { erro.textContent = "Digite a quantidade."; return null; } return { data: data, meta: "reels", valor: +q.value, extra: {} }; };
    }
    var fundo = h("div", { class: "fundo", role: "dialog", "aria-modal": "true", "aria-label": titulo, on: { click: function (e) { if (e.target === fundo) fechar(); } } });
    function fechar() { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") fechar(); }
    document.addEventListener("keydown", esc);
    var janela = h("form", { class: "janela", on: { submit: function (e) {
      e.preventDefault(); erro.textContent = "";
      var c = salvar(); if (!c) return;
      var antes = D.res ? D.res.total : 0;
      var salvoAntes = !!(D.res && D.res.dias[data] && D.res.dias[data].salvoPeloMinimo);
      tentar(Store.salvarCheckin(c)).then(recarregar).then(function () {
        fechar(); desenhar();
        var gan = D.res.total - antes, dd = D.res.dias[data] || {};
        if (dd.salvoPeloMinimo && !salvoAntes) { estado.diaRuim = false; desenhar(); toast("Dia salvo. A sequência continua."); return; }
        var itNovo = dd.itens && dd.itens[R.chave(c)];
        toast(gan > 0 ? "+" + gan + " pontos" + (itNovo && itNovo.minimo ? " (versão mínima)" : "") : "Lançado. Esta meta ainda não bateu.");
      }).catch(function () {});
    } } },
      h("h3", {}, titulo + " · " + (data === D.hoje ? "hoje" : "ontem")),
      campos, erro,
      h("button", { class: "btn", type: "submit" }, "Salvar e somar pontos"),
      existente ? h("button", { class: "btn perigo", type: "button", on: { click: function () {
        tentar(Store.removerCheckin(data, id)).then(recarregar).then(function () { fechar(); desenhar(); }).catch(function () {});
      } } }, "Remover lançamento") : null,
      h("button", { class: "btn sec", type: "button", on: { click: fechar } }, "Cancelar"));
    fundo.appendChild(janela); document.body.appendChild(fundo);
    var primeiroCampo = janela.querySelector("input,select,textarea"); if (primeiroCampo) primeiroCampo.focus();
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
    lista.forEach(function (p, i) {
      var sub = estado.aba === "hoje" ? (p.lancouHoje ? "Já lançou hoje" : "Ainda não lançou") : "Sequência " + p.sequencia + (p.sequencia === 1 ? " dia" : " dias") + " · aproveitamento " + pct(p.aproveitamento);
      var pts = estado.aba === "semana" ? p.pontosSemana : p.total;
      el.appendChild(h("div", { class: "rank" + (p.eu ? " eu" : "") },
        h("div", { class: "pos mono" }, estado.aba === "hoje" ? (p.lancouHoje ? "ok" : "..") : (i + 1)),
        h("div", { class: "corpo" }, h("div", { class: "nome" }, p.nome + (p.eu ? " (você)" : "")), h("div", { class: "sub" }, sub)),
        h("div", { class: "pts mono" }, pts)));
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
    el.appendChild(h("div", { class: "card destaque" }, h("div", { class: "apoio" }, "Pontos"), h("div", { class: "big mono", style: "font-size:44px;font-weight:700;line-height:1.1" }, res.total),
      h("div", { class: "apoio" }, res.pontosDias + " dos dias + " + res.pontosBonus + " de bônus · melhor sequência " + res.melhorSequencia + (res.melhorSequencia === 1 ? " dia" : " dias") +
        (t.diasSalvos ? " · " + t.diasSalvos + (t.diasSalvos === 1 ? " dia salvo" : " dias salvos") + " pela versão mínima" : ""))));

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
        semanas.map(function (w, i) { return h("div", { class: "b" + (w === atual ? " atual" : "") }, h("span", { class: "mono" }, vals[i]), h("i", { style: "height:" + Math.max(2, Math.round((vals[i] / max) * 90)) + "px" }), h("span", {}, dataBR(w))); }))));
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
          h("span", { class: "eq-trilho" }, h("i", { style: "width:" + Math.max(2, Math.round(a.pct * 100)) + "%" })),
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
  boot();
})();
