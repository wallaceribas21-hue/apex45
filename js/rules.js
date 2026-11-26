/* Regras do desafio: pontuacao, sequencia, bonus e totais.
   Funcao pura, sem tela. Roda no navegador (window.Regras) e no Node (tests/rules.test.js).
   Tudo marcado "sugestao" vem do SPEC.md (sugestao do Walla), ajustavel no Admin. */
(function (root) {
  "use strict";

  var PONTOS = {
    sono: 15, leitura: 15, agua: 10, refeicoes: 10, habito: 5,
    devocional: 10, treino: 20, individual: 10, culto: 10,
    reel: 2, reelsMaxDia: 3,
    bonusSemanaTreino: 20, bonusSemana90: 25, bonusQuiz: 10,
    marcos: { 7: 20, 14: 40, 21: 60, 30: 100, 45: 150 }
  };
  var REGRA = {
    sonoMinHoras: 7, sonoToleranciaMin: 30, // tolerancia: sugestao do Walla
    leituraMin: 20, aguaMinL: 3, refeicoesMin: 3, // card do Luiz 25/11: agua minimo 3 L
    // dia ruim (25/11): versao minima de cada meta. Vale metade dos pontos e segura a sequencia
    minimo: { sonoHoras: 6, leitura: 5, aguaL: 2, refeicoes: 2, treinoMin: 10 },
    musculacaoSemana: 3, cardioSemana: 2,
    aprovSequencia: 0.7, aprovDiaForte: 0.9, diasFortesSemana: 6
  };

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parse(iso) { var p = iso.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fmt(ms) { var d = new Date(ms); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function addDays(iso, n) { return fmt(parse(iso) + n * 86400000); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function dow(iso) { return new Date(parse(iso)).getUTCDay(); } // 0 domingo ... 6 sabado
  function weekStart(iso) { var d = dow(iso); return addDays(iso, d === 0 ? -6 : 1 - d); } // segunda
  function maxIso(a, b) { return a > b ? a : b; }
  function minIso(a, b) { return a < b ? a : b; }
  function hojeLocal() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function minutos(hhmm) { var p = String(hhmm || "").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function sleepHours(dormir, acordar) {
    if (!dormir || !acordar) return 0;
    var a = minutos(dormir), b = minutos(acordar);
    if (b <= a) b += 1440;
    return Math.round(((b - a) / 60) * 100) / 100;
  }
  function difCircular(a, b) { var d = Math.abs(minutos(a) - minutos(b)) % 1440; return Math.min(d, 1440 - d); }
  function sonoBate(dormir, acordar, part, regra) {
    var h = sleepHours(dormir, acordar);
    if (h < regra.sonoMinHoras) return false;
    if (part.dormir_alvo && difCircular(dormir, part.dormir_alvo) > regra.sonoToleranciaMin) return false;
    if (part.acordar_alvo && difCircular(acordar, part.acordar_alvo) > regra.sonoToleranciaMin) return false;
    return true;
  }

  // chave de uma meta: individuais viram "individual:<nome>"
  function chave(c) { return c.meta === "individual" ? "individual:" + ((c.extra && c.extra.nome) || c.nome || "") : c.meta; }

  function metasDoDia(part, data, treinoFalta, inicio) {
    var d = dow(data), m = {};
    m.sono = 1; m.leitura = 1; m.agua = 1; m.refeicoes = 1; m.devocional = 1;
    m.habito = part.mau_habito ? 1 : 0;
    m.treino = 1;
    if (d === 0 && !treinoFalta) m.treino = 0;
    m.individual = (part.metas_individuais && part.metas_individuais.length) ? 1 : 0;
    m.culto = d === 0 ? 1 : 0; // card do Luiz: culto de domingo
    return m;
  }
  function metade(n) { return Math.round(n / 2); }
  // metas que precisam de pelo menos a versao minima pro dia ser "salvo"
  var BASE_DIA = ["sono", "leitura", "agua", "alimentacao", "devocional"];
  function diaSalvo(itens, met) {
    var lista = BASE_DIA.slice(); if (met.treino) lista.push("treino");
    return lista.every(function (k) { var it = itens[k]; return it && (it.bateu || it.minimo); });
  }

  /* calcula tudo de 1 participante. checkins: [{data, meta, valor, extra}]  quizzes: [{semana}] (semana = segunda ISO) */
  function calcular(desafio, part, checkins, quizzes, hoje, opts) {
    opts = opts || {};
    var P = Object.assign({}, PONTOS, (desafio.regras_json && desafio.regras_json.pontos) || {});
    var R = Object.assign({}, REGRA, (desafio.regras_json && desafio.regras_json.regra) || {});
    var inicio = desafio.data_inicio, fim = desafio.data_fim;
    var entrou = part.entrou_em ? maxIso(part.entrou_em, inicio) : inicio;
    var ultimo = minIso(hoje, fim);
    var porDia = {};
    checkins.forEach(function (c) { (porDia[c.data] = porDia[c.data] || []).push(c); });

    var dias = {}, semanas = {}, bonus = [];
    var T = { paginas: 0, minMusc: 0, minCardio: 0, nMusc: 0, nCardio: 0, nDescanso: 0, sonoHoras: 0, sonoDias: 0, sonoNoHorario: 0,
              agua: 0, aguaDias: 0, reels: 0, devocional: 0, culto: 0, habito: 0, individuais: 0, refeicoesDias: 0, pontosDias: 0,
              diasMinimo: 0, diasSalvos: 0 };

    // dias na ordem, de "entrou" ate "ultimo"
    var d, wkCount = {}; // por semana: {musc, cardio}
    for (d = entrou; d <= ultimo; d = addDays(d, 1)) {
      var wk = weekStart(d);
      var W = wkCount[wk] = wkCount[wk] || { musc: 0, cardio: 0 };
      var lista = porDia[d] || [];
      var dw = dow(d);
      var semanaCompleta = wk >= entrou; // 1a semana parcial nao cobra reposicao
      var falta = (W.musc < R.musculacaoSemana || W.cardio < R.cardioSemana);
      var treinoFalta = dw === 0 && semanaCompleta && falta;
      var met = metasDoDia(part, d, treinoFalta, inicio);
      var itens = {}, pts = 0, ptsReels = 0, indOk = false, indLancou = false, M = R.minimo;

      lista.forEach(function (c) {
        var k = chave(c), v = c.valor || 0, x = c.extra || {}, bateu = false, p = 0, minimo = false;
        if (c.meta === "sono") {
          var h = sleepHours(x.dormir, x.acordar);
          bateu = sonoBate(x.dormir, x.acordar, part, R);
          if (bateu) p = P.sono;
          else if (h >= M.sonoHoras) { minimo = true; p = metade(P.sono); }
          T.sonoHoras += h; T.sonoDias++; if (bateu) T.sonoNoHorario++;
          x._horas = h;
        } else if (c.meta === "leitura") {
          bateu = v >= R.leituraMin; if (bateu) p = P.leitura; T.paginas += v;
          if (!bateu && v >= M.leitura) { minimo = true; p = metade(P.leitura); }
        } else if (c.meta === "agua") {
          var alvo = Math.max(R.aguaMinL, part.meta_agua_l || R.aguaMinL);
          bateu = v >= alvo; if (bateu) p = P.agua; T.agua += v; T.aguaDias++;
          if (!bateu && v >= M.aguaL) { minimo = true; p = metade(P.agua); }
        } else if (c.meta === "alimentacao") {
          var okRef = v >= R.refeicoesMin;
          if (okRef) p += P.refeicoes;
          if (okRef && x.cortou && part.mau_habito) { p += P.habito; T.habito++; }
          bateu = okRef; if (okRef) T.refeicoesDias++;
          if (!okRef && v >= M.refeicoes) { minimo = true; p = metade(P.refeicoes); }
        } else if (c.meta === "devocional") {
          if (v && x.minimo) { minimo = true; p = metade(P.devocional); T.devocional++; }
          else { bateu = !!v; if (bateu) { p = P.devocional; T.devocional++; } }
        } else if (c.meta === "culto") {
          bateu = !!v && met.culto === 1; if (bateu) { p = P.culto; T.culto++; }
        } else if (c.meta === "treino") {
          var tipo = x.tipo, min = x.minutos || v || 0, conta = false;
          if (tipo === "minimo") {
            // dia ruim: 10 min de qualquer movimento. Nao conta no plano da semana (3 musc + 2 cardio)
            if (met.treino && min >= M.treinoMin && !itens.treino) { minimo = true; p = metade(P.treino); }
          } else if (min > 0) {
            if (tipo === "descanso_ativo") { conta = dw === 6; if (conta) T.nDescanso++; }
            else if (tipo === "musculacao") {
              if (dw === 0 && !treinoFalta) conta = false;
              else if (W.musc < R.musculacaoSemana) { conta = true; W.musc++; T.nMusc++; T.minMusc += min; }
            } else if (tipo === "cardio") {
              if (dw === 0 && !treinoFalta) conta = false;
              else if (W.cardio < R.cardioSemana) { conta = true; W.cardio++; T.nCardio++; T.minCardio += min; }
            }
          }
          bateu = conta; if (conta && !itens.treino) p = P.treino;
        } else if (c.meta === "individual") {
          indLancou = true; if (v) { bateu = true; indOk = true; T.individuais++; }
          p = 0; // soma com teto abaixo
        } else if (c.meta === "reels") {
          var n = Math.max(0, v); T.reels += n;
          ptsReels = Math.min(n, P.reelsMaxDia) * P.reel; bateu = n > 0; p = 0;
        }
        itens[k] = { lancou: true, bateu: bateu, minimo: minimo && !bateu, pontos: p, valor: v, extra: x };
        pts += p;
      });
      if (indOk) { pts += P.individual; }

      var possivel = 0;
      if (met.sono) possivel += P.sono;
      if (met.leitura) possivel += P.leitura;
      if (met.agua) possivel += P.agua;
      if (met.refeicoes) possivel += P.refeicoes;
      if (met.habito) possivel += P.habito;
      if (met.devocional) possivel += P.devocional;
      if (met.treino) possivel += P.treino;
      if (met.individual) possivel += P.individual;
      if (met.culto) possivel += P.culto;
      var aprov = possivel ? Math.min(1, pts / possivel) : 1;
      var salvo = diaSalvo(itens, met);
      var usouMin = Object.keys(itens).some(function (kk) { return itens[kk].minimo; });
      if (usouMin) T.diasMinimo++;
      if (salvo && aprov < R.aprovSequencia) T.diasSalvos++;
      dias[d] = { data: d, pontos: pts + ptsReels, pontosBase: pts, pontosReels: ptsReels, possivel: possivel, aprov: aprov,
                  itens: itens, lancou: lista.length > 0, dow: dw, treinoFalta: treinoFalta, metas: met, indLancou: indLancou,
                  salvo: salvo, salvoPeloMinimo: salvo && aprov < R.aprovSequencia, usouMinimo: usouMin };
      T.pontosDias += pts + ptsReels;
    }

    // sequencia (um dia ruim segura, dois seguidos zeram) e marcos (1 vez cada)
    var streak = 0, miss = false, maxStreak = 0, marcosFeitos = {};
    for (d = entrou; d <= ultimo; d = addDays(d, 1)) {
      var di = dias[d];
      var pendente = (d === hoje && !di.lancou); // hoje ainda sem lancar nao penaliza
      if (pendente) continue;
      if ((di.aprov >= R.aprovSequencia && di.lancou) || di.salvo) { streak++; miss = false; } // dia salvo pela versao minima conta
      else if (d === hoje) { continue; }
      else if (miss) { streak = 0; miss = false; }
      else { miss = true; }
      if (streak > maxStreak) maxStreak = streak;
      if (P.marcos[streak] && !marcosFeitos[streak]) {
        marcosFeitos[streak] = 1;
        bonus.push({ tipo: "sequencia", ref: String(streak), pontos: P.marcos[streak], data: d, label: "Sequência de " + streak + " dias" });
      }
    }

    // bonus semanais (so semanas que comecam depois da entrada) e quiz
    var wkSet = {};
    for (d = entrou; d <= ultimo; d = addDays(d, 1)) wkSet[weekStart(d)] = 1;
    Object.keys(wkSet).sort().forEach(function (wk) {
      var W = wkCount[wk] || { musc: 0, cardio: 0 };
      var fortes = 0, dd;
      for (var i = 0; i < 7; i++) { dd = addDays(wk, i); if (dias[dd] && dias[dd].lancou && dias[dd].aprov >= R.aprovDiaForte) fortes++; }
      var semTreino = (wk >= entrou) && W.musc >= R.musculacaoSemana && W.cardio >= R.cardioSemana;
      semanas[wk] = { semana: wk, musc: W.musc, cardio: W.cardio, fortes: fortes };
      if (semTreino) bonus.push({ tipo: "semana", ref: wk + ":treino", pontos: P.bonusSemanaTreino, data: wk, label: "Semana de treino completa" });
      if (fortes >= R.diasFortesSemana) bonus.push({ tipo: "semana", ref: wk + ":90", pontos: P.bonusSemana90, data: wk, label: "6 dias com 90% ou mais" });
    });
    (quizzes || []).forEach(function (q) {
      bonus.push({ tipo: "quiz", ref: q.semana, pontos: P.bonusQuiz, data: q.semana, label: "Quiz da semana respondido" });
    });

    var totalBonus = bonus.reduce(function (s, b) { return s + b.pontos; }, 0);
    var possTot = 0, ptsTot = 0;
    Object.keys(dias).forEach(function (k) { var x = dias[k]; if (!(k === hoje && !x.lancou)) { possTot += x.possivel; ptsTot += Math.min(x.pontosBase, x.possivel); } });

    return {
      dias: dias, semanas: semanas, bonus: bonus, totais: T,
      pontosDias: T.pontosDias, pontosBonus: totalBonus, total: T.pontosDias + totalBonus,
      sequencia: streak, melhorSequencia: maxStreak, P: P,
      aproveitamento: possTot ? ptsTot / possTot : 0
    };
  }

  function pontosSemana(res, wk) {
    var s = 0, i, d;
    for (i = 0; i < 7; i++) { d = addDays(wk, i); if (res.dias[d]) s += res.dias[d].pontos; }
    res.bonus.forEach(function (b) { if (b.tipo !== "sequencia" && String(b.data) === wk) s += b.pontos; });
    return s;
  }

  /* Painel de equilibrio (25/11): as 7 areas do card numa semana.
     Cada area = pontos ganhos / pontos possiveis da area nos dias ja vividos da semana (versao minima conta metade).
     Conteudo = reels da semana / ritmo da meta (meta_reels dividida pelos dias do desafio). Hoje so entra se ja lancou algo. */
  var AREAS = [
    { id: "sono", nome: "Sono", metas: ["sono"] },
    { id: "treino", nome: "Treino", metas: ["treino"] },
    { id: "leitura", nome: "Leitura", metas: ["leitura"] },
    { id: "agua", nome: "Água", metas: ["agua"] },
    { id: "alimentacao", nome: "Alimentação", metas: ["refeicoes", "habito"] },
    { id: "espiritual", nome: "Espiritual", metas: ["devocional", "culto"] }
  ];
  function equilibrio(res, part, desafio, wk, hoje) {
    var P = res.P || PONTOS, out = [], dias = [], i, d;
    for (i = 0; i < 7; i++) {
      d = addDays(wk, i);
      if (d > hoje || !res.dias[d]) continue;
      if (d === hoje && !res.dias[d].lancou) continue;
      dias.push(res.dias[d]);
    }
    function ganho(di, meta) {
      if (meta === "refeicoes" || meta === "habito") { var a = di.itens.alimentacao; if (!a) return 0; return meta === "habito" ? Math.max(0, a.pontos - P.refeicoes) : Math.min(a.pontos, P.refeicoes); }
      var it = di.itens[meta]; return it ? it.pontos : 0;
    }
    AREAS.forEach(function (A) {
      var g = 0, p = 0;
      dias.forEach(function (di) { A.metas.forEach(function (m) { if (di.metas[m]) { p += P[m]; g += ganho(di, m); } }); });
      if (p > 0) out.push({ id: A.id, nome: A.nome, pct: Math.min(1, g / p), ganho: g, possivel: p });
    });
    if (part.e_digital && part.meta_reels > 0) {
      var tot = diffDays(desafio.data_inicio, desafio.data_fim) + 1, reels = 0;
      dias.forEach(function (di) { var it = di.itens.reels; if (it) reels += it.valor || 0; });
      var alvo = (part.meta_reels / tot) * dias.length;
      if (dias.length) out.push({ id: "conteudo", nome: "Conteúdo", pct: alvo ? Math.min(1, reels / alvo) : 1, ganho: reels, possivel: Math.round(alvo * 10) / 10 });
    } else if (part.metas_individuais && part.metas_individuais.length) {
      var gi = 0, pi = 0;
      dias.forEach(function (di) { if (di.metas.individual) { pi += P.individual; if (Object.keys(di.itens).some(function (k) { return k.indexOf("individual:") === 0 && di.itens[k].bateu; })) gi += P.individual; } });
      if (pi) out.push({ id: "individual", nome: "Individuais", pct: gi / pi, ganho: gi, possivel: pi });
    }
    var atras = null;
    out.forEach(function (a) { if (a.pct < 1 && (!atras || a.pct < atras.pct)) atras = a; });
    return { semana: wk, dias: dias.length, areas: out, atras: atras };
  }

  // janela do quiz: abre 2 dias antes da reuniao da semana, fecha no domingo
  function janelaQuiz(desafio, hoje) {
    var wk = weekStart(hoje);
    var rd = desafio.reuniao_dia == null ? 3 : desafio.reuniao_dia;
    var reuniao = addDays(wk, rd === 0 ? 6 : rd - 1);
    var abre = addDays(reuniao, -2), fecha = addDays(wk, 6);
    return { semana: wk, reuniao: reuniao, abre: abre, aberto: hoje >= abre && hoje <= fecha };
  }

  function diaDoDesafio(desafio, hoje) {
    var total = diffDays(desafio.data_inicio, desafio.data_fim) + 1;
    var n = diffDays(desafio.data_inicio, hoje) + 1;
    return { n: n, total: total, antes: n < 1, depois: n > total };
  }

  var api = {
    PONTOS: PONTOS, REGRA: REGRA, addDays: addDays, diffDays: diffDays, dow: dow, weekStart: weekStart, hojeLocal: hojeLocal,
    sleepHours: sleepHours, sonoBate: sonoBate, calcular: calcular, pontosSemana: pontosSemana, janelaQuiz: janelaQuiz,
    diaDoDesafio: diaDoDesafio, chave: chave, equilibrio: equilibrio, AREAS: AREAS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Regras = api;
})(typeof window !== "undefined" ? window : this);
