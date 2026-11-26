/* Modo SUPABASE: login por link no e-mail, dados no banco. Mesma interface do store-demo.js.
   v2 (25/11): a pontuacao vem do rules.js (igual ao demo). Cada um grava o proprio resumo na tabela "resumo"
   e o ranking le o resumo dos outros (so pontos, sequencia e se ja marcou hoje, nunca o detalhe). */
(function (root) {
  "use strict";
  var R = root.Regras, cfg = root.DESAFIO_CONFIG || {}, sb = null, ctx = null;

  function ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }
  // mesma data do banco (hoje_br = Sao Paulo), senao quem esta em outro fuso perto da meia-noite tem o lancamento recusado
  function hoje() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return R.hojeLocal(); }
  }
  function convite() { var m = /[?&]convite=([A-Za-z0-9]+)/.exec(location.search); return m ? m[1] : null; }

  var Store = {
    modo: "supabase",
    init: function () {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
        s.onload = function () {
          sb = root.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
          // revisao 25/11: sem internet com o token vencido o getSession devolve erro de rede: NAO e "deslogado"
          // (senao a pessoa toca Entrar e vira outra). Mostra "Algo nao abriu / Tentar de novo".
          sb.auth.getSession().then(function (r) {
            var sess = r && r.data ? r.data.session : null;
            if (!sess && r && r.error && (r.error.name === "AuthRetryableFetchError" || /fetch|network|rede|Failed/i.test(r.error.message || ""))) {
              return reject(new Error("Sem conexão agora. Confira a internet e toque em Tentar de novo."));
            }
            ctx = { session: sess }; resolve();
          }, function () { reject(new Error("Sem conexão agora. Confira a internet e toque em Tentar de novo.")); });
        };
        s.onerror = function () { reject(new Error("Não consegui carregar o Supabase. Confira a internet.")); };
        document.head.appendChild(s);
      });
    },
    sessao: function () { if (!ctx || !ctx.session) return null; var u = ctx.session.user; return { email: u.email || null, anonimo: u.is_anonymous === true || !u.email }; },
    entrar: function (email) {
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href.split("#")[0] } }).then(ok);
    },
    // v3 (25/11): acesso de cada um SEM e-mail. Toca, entra; a sessao fica guardada no celular.
    // revisao 25/11: so entra no desafio pelo convite quando a pessoa TOCA em Entrar (querEntrar), nunca sozinho
    entrarDireto: function () {
      ctx.querEntrar = true; ctx.convitePerdido = null;
      return Store.sessaoAnonima();
    },
    sessaoAnonima: function () {
      if (ctx.session) return Promise.resolve();
      return sb.auth.signInAnonymously().then(function (r) {
        if (r.error) throw new Error(/anonymous/i.test(r.error.message) ? "A entrada sem e-mail ainda não foi ligada. Avise o Admin." : r.error.message);
        ctx.session = r.data.session;
      });
    },
    // outro celular: o codigo pessoal devolve a mesma pessoa (pontos e metas)
    entrarComCodigo: function (codigo) {
      ctx.querEntrar = false;
      return Store.sessaoAnonima().then(function () { return sb.rpc("recuperar_acesso", { p_codigo: codigo }); }).then(ok).then(function (pid) {
        if (!pid) throw new Error("Código não encontrado. Confira as 6 letras.");
      });
    },
    acessosDoGrupo: function () {
      return sb.rpc("acessos_do_grupo", { did: ctx.ids.d }).then(ok).then(function (r) { return (r || []).map(function (x) { return { id: x.participante_id, nome: x.nome, codigo: x.codigo_acesso }; }); });
    },
    sair: function () { return sb.auth.signOut().then(function () { ctx.session = null; ctx.querEntrar = false; ctx.convitePerdido = null; }); },
    hoje: hoje,
    setHoje: function () {},

    carregar: function () {
      var uid = ctx.session.user.id, h = hoje(), cod = convite();
      return sb.from("participantes").select("*, desafios(*)").eq("user_id", uid).order("created_at", { ascending: true }).limit(1).then(ok).then(function (rows) {
        // entra sozinho so se tocou em Entrar (anonimo) ou se veio do login por e-mail (v1)
        var podeEntrar = ctx.querEntrar || !Store.sessao().anonimo;
        if (!rows.length && cod && podeEntrar && !ctx.convitePerdido) return sb.rpc("entrar_no_desafio", { codigo: cod }).then(ok)
          .then(function () { ctx.querEntrar = false; return Store.carregar(); }, function (e) {
            // convite errado ou desafio fechado: cai na tela "sem desafio" (que tem Sair), sem travar o app
            ctx.convitePerdido = e.message || "Convite inválido";
            return Store.carregar();
          }).then(function (x) { return { __done: x }; });
        return rows;
      }).then(function (rows) {
        if (rows && rows.__done) return rows.__done;
        if (!rows.length) return { modo: "supabase", hoje: h, semDesafio: true, temConvite: !!cod, erroConvite: ctx.convitePerdido || null, user: Store.sessao() };
        var me = rows[0], d = me.desafios; delete me.desafios;
        var ids = { p: me.id, d: d.id };
        ctx.ids = ids;
        return Promise.all([
          sb.from("checkins").select("*").eq("participante_id", me.id).then(ok),
          sb.from("quiz_semana").select("*").eq("participante_id", me.id).then(ok),
          sb.from("resumo").select("*").eq("desafio_id", d.id).then(ok),
          sb.from("fotos").select("*").eq("participante_id", me.id).then(ok),
          sb.from("resumo_quiz").select("*").eq("desafio_id", d.id).then(ok)
        ]).then(function (r) {
          var checkins = r[0].map(function (c) { return { data: c.data, meta: c.meta, valor: Number(c.valor), extra: Object.assign({}, c.extra, c.meta === "individual" ? { nome: String(c.chave || "").replace(/^individual:/, "") } : {}) }; });
          var quizzes = r[1];
          var res = R.calcular(d, me, checkins, quizzes, h);
          var wk = R.weekStart(h);
          var ultimo = checkins.reduce(function (m, c) { return c.data > m ? c.data : m; }, "");
          var meu = { participante_id: me.id, desafio_id: d.id, total: res.total, sequencia: res.sequencia,
            aproveitamento: Math.round(res.aproveitamento * 10000) / 10000, semana: wk, pontos_semana: R.pontosSemana(res, wk),
            ultimo_lancamento: ultimo || null };
          // v2: o app calcula (rules.js) e grava o proprio resumo; o grupo le o resumo dos outros
          // revisao 25/11: sem nome ainda nao entra no ranking (evita "Participante" fantasma na cobranca)
          var gravar = !me.nome ? Promise.resolve() : sb.from("resumo").upsert(meu, { onConflict: "participante_id" }).then(function (x) { if (x.error) console.warn("resumo:", x.error.message); });
          var linhas = r[2].filter(function (p) { return p.participante_id !== me.id; });
          if (me.nome) linhas.push(Object.assign({ nome: me.nome || "Você" }, meu));
          var placar = linhas.map(function (p) {
            var eu = p.participante_id === me.id;
            // quem nao abre o app ha 3+ dias nao lancou nada nesse tempo: 2 dias seguidos sem lancar zeram a sequencia
            var parado = !eu && p.calculado_em && R.diffDays(p.calculado_em, h) >= 3;
            return { id: p.participante_id, nome: eu ? (me.nome || p.nome) : p.nome, exemplo: false, eu: eu,
              total: eu ? res.total : p.total, sequencia: eu ? res.sequencia : (parado ? 0 : p.sequencia),
              aproveitamento: eu ? res.aproveitamento : Number(p.aproveitamento),
              pontosSemana: eu ? meu.pontos_semana : (p.semana === wk ? p.pontos_semana : 0),
              lancouHoje: eu ? !!(res.dias[h] && res.dias[h].lancou) : p.ultimo_lancamento === h };
          }).sort(function (a, b) { return b.total - a.total; });
          return gravar.then(function () { return [r, checkins, quizzes, res, placar]; });
        }).then(function (pack) {
          var r = pack[0], checkins = pack[1], quizzes = pack[2], res = pack[3], placar = pack[4];
          var resumo = { dificuldade: { muito_facil: 0, ok: 0, dificil: 0, muito_dificil: 0 }, travou: {}, total: 0 };
          r[4].forEach(function (x) {
            if (x.tipo === "dificuldade") resumo.dificuldade[x.valor] = x.qtd; else resumo.travou[x.valor] = x.qtd;
          });
          resumo.total = Object.keys(resumo.dificuldade).reduce(function (s, k) { return s + resumo.dificuldade[k]; }, 0);
          var fotos = { antes: null, depois: null, visivel: false };
          r[3].forEach(function (f) { fotos[f.tipo] = f.arquivo_path; fotos.visivel = f.visivel_grupo; });
          return { modo: "supabase", hoje: h, desafio: d, me: me, checkins: checkins, quizzes: quizzes, fotos: fotos, res: res,
            placar: placar, admin: d.admin_id === uid, user: Store.sessao(), resumoQuiz: resumo };
        });
      });
    },
    criarDesafio: function (nome, inicio, fim) { return sb.rpc("criar_desafio", { p_nome: nome, p_inicio: inicio, p_fim: fim }).then(ok); },
    // o participante sempre nasce pelas funcoes criar_desafio / entrar_no_desafio; aqui so atualiza
    salvarPerfil: function (p) { return sb.from("participantes").update(p).eq("id", ctx.ids.p).then(ok); },
    salvarCheckin: function (c) {
      var chave = R.chave(c);
      return sb.from("checkins").upsert({
        participante_id: ctx.ids.p, data: c.data, meta: c.meta, chave: chave, valor: c.valor || 0,
        extra: c.extra || {}
      }, { onConflict: "participante_id,data,chave" }).then(ok);
    },
    removerCheckin: function (data, chave) { return sb.from("checkins").delete().eq("participante_id", ctx.ids.p).eq("data", data).eq("chave", chave).then(ok); },
    salvarQuiz: function (q) {
      return sb.from("quiz_semana").upsert(Object.assign({ participante_id: ctx.ids.p }, q), { onConflict: "participante_id,semana" }).then(ok);
    },
    salvarDesafio: function (patch) { return sb.from("desafios").update(patch).eq("id", ctx.ids.d).then(ok); },
    salvarFoto: function (tipo, dataUrl) {
      return fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
        var path = ctx.ids.d + "/" + ctx.ids.p + "/" + tipo + ".jpg";
        return sb.storage.from("fotos").upload(path, blob, { upsert: true, contentType: "image/jpeg" }).then(function (r) { if (r.error) throw r.error; })
          .then(function () { return sb.from("fotos").upsert({ participante_id: ctx.ids.p, tipo: tipo, arquivo_path: path }, { onConflict: "participante_id,tipo" }).then(ok); });
      });
    },
    fotoUrl: function (path) {
      return sb.storage.from("fotos").createSignedUrl(path, 3600).then(function (r) { return r.error ? null : r.data.signedUrl; });
    },
    fotoVisivel: function (v) { return sb.from("fotos").update({ visivel_grupo: !!v }).eq("participante_id", ctx.ids.p).then(ok); },
    gerarConvite: function (codigo) { return Promise.resolve(location.href.split("#")[0].split("?")[0] + "?convite=" + codigo); },
    participantes: function () { return sb.from("resumo").select("participante_id,nome").eq("desafio_id", ctx.ids.d).then(ok).then(function (r) { return r.map(function (x) { return { id: x.participante_id, nome: x.nome }; }); }); },
    removerParticipante: function (id) { return sb.rpc("remover_participante", { pid: id }).then(ok); },
    erroSalvar: function () { return null; }
  };
  root.Store = Store;
})(window);
