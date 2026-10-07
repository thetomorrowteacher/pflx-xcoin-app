/* ═══ PflxMarket v1 -- the one PFLX marketplace card module ═══════════════════
   One copy lives in each app (X-Coin public/, Battle Arena public/, X-Live
   index.html inline). The copies are byte-identical; a test compares them.
   Three upgrade kinds + taxes, each OWNED by one app:
     platform + tax  -> X-Coin     (app_data key 'modifiers')
     game            -> Battle Arena (app_data key 'pflx_market_game', published by the Arena)
     session         -> X-Live     (app_data key 'pflx_lite_config' .upgrades)
   This module only READS those, normalizes them into one item shape and draws
   them in the X-Coin card design. It never writes to the wallet or a catalog.
   Buying: the host app passes opts.buy[kind](item); a kind with no buyer here
   gets a button that opens the app that owns it (opts.goto). Taxes never sell.
   Item: { id, kind, home, name, desc, icon, image, cost, duration, auto,
           trigger, effect, scope, tier, tierLabel }                              */
(function (root) {
  if (root.PflxMarket) return;
  var KINDS = {
    platform: { label: 'PLATFORM', tab: 'Platform', color: '#4f8ef7', home: 'xcoin', homeName: 'X-Coin' },
    game:     { label: 'GAME',     tab: 'Game',     color: '#ffd166', home: 'arena', homeName: 'Battle Arena' },
    session:  { label: 'SESSION',  tab: 'Session',  color: '#b388ff', home: 'xlive', homeName: 'X-Live' },
    tax:      { label: 'TAX / FINE', tab: 'Taxes & Fines', color: '#ff5c6c', home: 'xcoin', homeName: 'X-Coin' }
  };
  var ORDER = ['platform', 'game', 'session', 'tax'];
  var HOME_LABEL = { xcoin: 'X-COIN', arena: 'BATTLE ARENA', xlive: 'X-LIVE' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function truthy(v) { return v === true || v === 'true' || v === 'True' || v === 1; }
  function safeImg(u) { u = String(u || ''); return /^(https:\/\/|data:image\/(png|jpeg|jpg|webp|gif);base64,)/i.test(u) && u.length < 450000 ? u : ''; }
  function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function effectText(m) {
    var v = m.effectValue, e = m.effectType;
    var map = { deadline_extend: 'Extend Deadline (hrs)', xc_multiply: 'Multiply XC', xc_deduct: 'Deduct XC', xc_add: 'Add XC', xc_bonus: 'Bonus XC', freeze: 'Freeze Privileges', badge_add: 'Add Badge', badge_deduct: 'Deduct Badge' };
    return (map[e] || label(e || 'Effect')) + (v || v === 0 ? ' · ' + v : '');
  }

  // ── Adapters: each app's own data → one item shape ──
  function fromModifier(m) {
    if (!m || typeof m !== 'object' || !m.name) return null;
    var isTax = m.type === 'tax';
    if (m.type !== 'tax' && m.type !== 'upgrade') return null;
    // v1.79: purchasable:false = granted by System Events / slot-machine awards / reward packs only, never listed for sale.
    if (m.purchasable === false) return null;
    return {
      id: 'mod:' + (m.id || m.name), rawId: String(m.id || ''), kind: isTax ? 'tax' : 'platform', home: 'xcoin',
      name: String(m.name), desc: String(m.description || ''), icon: String(m.icon || (isTax ? '⚠️' : '⚡')), image: safeImg(m.image || m.img || m.imageUrl),
      cost: Math.max(0, Math.round(num(m.costXcoin))), duration: String(m.duration || (isTax ? 'immediate' : 'single-use')),
      auto: truthy(m.autoApply), trigger: label(m.triggerEvent || 'manual'), effect: m.effectType ? effectText(m) : '—', scope: label(m.scope || 'all'),
      badge: Math.max(0, Math.round(num(m.costBadge))), minRank: m.minRank, maxRank: m.maxRank, restricted: m.availableTo === 'restricted'
    };
  }
  function fromSession(u) {
    if (!u || typeof u !== 'object' || !(u.label || u.name)) return null;
    return {
      id: 'ses:' + (u.id || u.label), rawId: String(u.id || ''), kind: 'session', home: 'xlive',
      name: String(u.label || u.name), desc: String(u.desc || u.description || 'Redeem in class.'), icon: String(u.icon || '🎁'), image: safeImg(u.image),
      cost: Math.max(0, Math.round(num(u.cost))), duration: 'single-use', auto: false, trigger: 'Live session', effect: String(u.label || u.name), scope: 'You'
    };
  }
  function fromGame(g) {
    if (!g || typeof g !== 'object' || !g.name || !g.key) return null;
    return {
      id: 'game:' + g.key, rawId: String(g.key), kind: 'game', home: 'arena',
      name: String(g.name), desc: String(g.desc || ''), icon: String(g.icon || '🎮'), image: safeImg(g.image),
      cost: Math.max(0, Math.round(num(g.price != null ? g.price : g.cost))), duration: String(g.duration || 'one round'),
      auto: !!g.fires, trigger: g.fires ? 'When triggered' : 'Round start', effect: String(g.effect || g.name), scope: 'Nexus Frontiers',
      tier: num(g.tier, 1), tierLabel: String(g.tierLabel || '')
    };
  }

  // kv(key) -> Promise<data|null>. Every app hands in its own loader; failures just leave that kind empty.
  function load(kv) {
    var out = { platform: [], game: [], session: [], tax: [], ok: { platform: false, game: false, session: false }, at: Date.now() };
    function safe(key) { try { return Promise.resolve(kv(key)).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
    return Promise.all([safe('modifiers'), safe('pflx_market_game'), safe('pflx_lite_config')]).then(function (r) {
      var mods = r[0], game = r[1], cfg = r[2];
      if (mods && !Array.isArray(mods) && Array.isArray(mods.items)) mods = mods.items;
      if (Array.isArray(mods)) { out.ok.platform = true; mods.forEach(function (m) { var it = fromModifier(m); if (it) out[it.kind].push(it); }); }
      var gi = game && (Array.isArray(game) ? game : game.items);
      if (Array.isArray(gi)) { out.ok.game = true; gi.forEach(function (g) { var it = fromGame(g); if (it) out.game.push(it); }); }
      var su = cfg && cfg.upgrades;
      if (Array.isArray(su)) { out.ok.session = true; su.forEach(function (u) { var it = fromSession(u); if (it) out.session.push(it); }); }
      return out;
    });
  }

  // ── CSS (X-Coin card design; inherits the host app's font) ──
  var CSS = '.pm{font-family:inherit;color:#e8ecff}.pm *{box-sizing:border-box}' +
    '.pm-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.08);margin:0 0 16px}' +
    '.pm-tab{background:none;border:0;border-bottom:2px solid transparent;color:rgba(255,255,255,.4);padding:9px 14px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:-1px}' +
    '.pm-tab:hover{color:rgba(255,255,255,.75)}.pm-tab.on{color:var(--pmc,#4f8ef7);border-bottom-color:var(--pmc,#4f8ef7)}.pm-tab b{font-weight:600;opacity:.6;margin-left:5px;font-size:11px}' +
    '.pm-bal{font-size:12px;color:#8a93b8;margin:0 0 14px}.pm-bal b{color:#ffd166}' +
    '.pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}' +
    '.pm-card{border:1px solid color-mix(in srgb,var(--pmc,#4f8ef7) 38%,transparent);background:rgba(10,14,28,.88);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 0 0 1px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35)}' +
    '.pm-top{display:flex;gap:12px;align-items:flex-start}.pm-ic{width:54px;height:54px;flex:none;border-radius:14px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:26px}.pm-ic img{width:100%;height:100%;object-fit:cover}' +
    '.pm-t{flex:1;min-width:0}.pm-t b{display:block;font-size:15px;line-height:1.25}.pm-t p{margin:4px 0 0;font-size:12.5px;color:rgba(255,255,255,.55);line-height:1.4}' +
    '.pm-tags{display:flex;flex-direction:column;gap:4px;align-items:flex-end}.pm-tag{font-size:9.5px;font-weight:800;letter-spacing:.08em;border-radius:7px;padding:3px 7px;border:1px solid;white-space:nowrap}' +
    '.pm-kind{color:var(--pmc,#4f8ef7);border-color:color-mix(in srgb,var(--pmc,#4f8ef7) 45%,transparent);background:color-mix(in srgb,var(--pmc,#4f8ef7) 12%,transparent)}' +
    '.pm-auto{color:#4fd1ff;border-color:rgba(79,209,255,.4);background:rgba(79,209,255,.1)}.pm-man{color:#9aa3c4;border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.05)}.pm-live{color:#c9a8ff;border-color:rgba(179,136,255,.4);background:rgba(179,136,255,.1)}' +
    '.pm-strip{display:flex;align-items:stretch;gap:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);border-radius:12px;padding:9px 12px}' +
    '.pm-strip div{flex:1;min-width:0;font-size:12px;font-weight:700;color:#7de9ff;overflow-wrap:anywhere}.pm-strip div:nth-child(3){color:#b79bff}.pm-strip div:nth-child(5){color:#e8ecff}' +
    '.pm-strip small{display:block;font-size:9px;letter-spacing:.1em;color:rgba(255,255,255,.4);font-weight:700;margin-bottom:2px}.pm-strip i{align-self:center;color:rgba(255,255,255,.25);font-style:normal}' +
    '.pm-chips{display:flex;gap:8px;flex-wrap:wrap}.pm-chip{display:inline-flex;align-items:center;gap:6px;border-radius:9px;padding:5px 10px;font-size:12px;font-weight:700;background:rgba(255,255,255,.06);color:rgba(255,255,255,.55)}' +
    '.pm-chip.c{background:rgba(255,209,102,.12);color:#ffd166}.pm-coin{width:11px;height:11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#9aa3b8 60%,#5b6378);display:inline-block}' +
    '.pm-btns{display:flex;gap:8px;margin-top:auto}.pm-btn{flex:1;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#fff;font:inherit;font-weight:700;font-size:13px;padding:10px 12px;cursor:pointer}' +
    '.pm-btn:hover:not(:disabled){background:rgba(255,255,255,.1)}.pm-btn.buy{background:linear-gradient(180deg,rgba(255,209,102,.22),rgba(255,209,102,.1));border-color:rgba(255,209,102,.5);color:#ffd166}' +
    '.pm-btn.go{border-color:color-mix(in srgb,var(--pmc,#4f8ef7) 55%,transparent);color:var(--pmc,#4f8ef7)}.pm-btn.edit{flex:0 0 auto}.pm-btn:disabled{opacity:.45;cursor:not-allowed}' +
    '.pm-empty{border:1px dashed rgba(255,255,255,.15);border-radius:14px;padding:22px;text-align:center;font-size:13px;color:rgba(255,255,255,.45)}' +
    '.pm-note{font-size:12px;color:rgba(255,255,255,.45);margin:0 0 14px;line-height:1.5}';
  function ensureCss() {
    if (typeof document === 'undefined' || document.getElementById('pm-css')) return;
    var s = document.createElement('style'); s.id = 'pm-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }

  // ── Rendering ──
  var MOUNTS = {}, SEQ = 0;
  function priceOf(it, o) { var f = o && o.priceFor; var p = f ? num(f(it), it.cost) : it.cost; return Math.max(0, Math.round(p)); }
  function cardHtml(it, o, mid) {
    var K = KINDS[it.kind], isTax = it.kind === 'tax', price = priceOf(it, o);
    var art = it.image ? '<img src="' + esc(it.image) + '" alt="">' : '<span>' + esc(it.icon) + '</span>';
    var tag = isTax ? (it.auto ? '<span class="pm-tag pm-auto">⚡ AUTO</span>' : '<span class="pm-tag pm-man">MANUAL</span>')
      : it.kind === 'session' ? '<span class="pm-tag pm-live">● LIVE</span>' : (it.auto ? '<span class="pm-tag pm-auto">⚡ AUTO</span>' : '');
    var tier = it.tierLabel && String(it.name).indexOf(it.tierLabel) < 0 ? ' <span style="color:' + K.color + ';font-size:11px;font-weight:700">' + esc(it.tierLabel) + '</span>' : '';
    var chips = '<span class="pm-chip c"><i class="pm-coin"></i>' + price.toLocaleString() + ' XC</span>' + (it.badge ? '<span class="pm-chip" style="background:rgba(167,139,250,.14);color:#c4b5fd">🏅 ' + it.badge + ' Badge' + (it.badge === 1 ? '' : 's') + '</span>' : '') + '<span class="pm-chip"><i class="pm-coin" style="opacity:.5"></i>' + esc(it.duration) + '</span>';
    var btns = '';
    var here = o.app && it.home === o.app;
    if (!isTax) {
      var buyer = o.buy && o.buy[it.kind];
      if (buyer) {
        var st = o.canBuy ? o.canBuy(it) : { ok: true };
        btns += '<button class="pm-btn buy" ' + (st && st.ok === false ? 'disabled title="' + esc(st.why || '') + '"' : '') + ' data-m="' + mid + '" data-i="' + esc(it.id) + '" data-w="buy" onclick="PflxMarket._act(this)">' + (st && st.ok === false ? esc(st.label || 'UNAVAILABLE') : 'BUY · ' + price.toLocaleString() + ' XC') + '</button>';
      } else if (!here && !o.isHost) {
        btns += '<button class="pm-btn go" data-m="' + mid + '" data-i="' + esc(it.id) + '" data-w="goto" onclick="PflxMarket._act(this)">' + (it.kind === 'session' ? 'REDEEM IN ' : 'BUY IN ') + HOME_LABEL[it.home] + ' ›</button>';
      }
    }
    if (o.isHost) btns += '<button class="pm-btn edit" data-m="' + mid + '" data-i="' + esc(it.id) + '" data-w="edit" onclick="PflxMarket._act(this)">' + (here ? 'Edit' : 'Edit in ' + esc(K.homeName)) + '</button>';
    return '<div class="pm-card" style="--pmc:' + K.color + '"><div class="pm-top"><div class="pm-ic">' + art + '</div>' +
      '<div class="pm-t"><b>' + esc(it.name) + tier + '</b><p>' + esc(it.desc) + '</p></div><div class="pm-tags"><span class="pm-tag pm-kind">' + K.label + '</span>' + tag + '</div></div>' +
      '<div class="pm-strip"><div><small>TRIGGER</small>' + esc(it.trigger) + '</div><i>›</i><div><small>EFFECT</small>' + esc(it.effect) + '</div><i>›</i><div><small>SCOPE</small>' + esc(it.scope) + '</div></div>' +
      '<div class="pm-chips">' + chips + '</div>' + (btns ? '<div class="pm-btns">' + btns + '</div>' : '') + '</div>';
  }
  function itemsFor(m, tab) {
    var cs = m.opts.canSee, vis = function (list) { return cs ? list.filter(function (it) { try { return cs(it) !== false; } catch (e) { return true; } }) : list; };
    if (tab === 'all') return ORDER.filter(function (k) { return k !== 'tax'; }).reduce(function (a, k) { return a.concat(vis(m.data[k])); }, []);
    return vis(m.data[tab] || []);
  }
  function html(m) {
    var o = m.opts, d = m.data, kinds = o.kinds || ORDER;
    var tabs = ['all'].concat(kinds).filter(function (k) { return k === 'all' ? kinds.filter(function (x) { return x !== 'tax'; }).length > 1 : true; });
    if (tabs.indexOf(m.tab) < 0) m.tab = o.tab && tabs.indexOf(o.tab) >= 0 ? o.tab : tabs[0];
    var bar = tabs.map(function (t) {
      var n = itemsFor(m, t).length, c = t === 'all' ? '#7de9ff' : KINDS[t].color;
      return '<button class="pm-tab' + (m.tab === t ? ' on' : '') + '" style="--pmc:' + c + '" data-m="' + m.id + '" data-i="' + t + '" data-w="tab" onclick="PflxMarket._act(this)">' + (t === 'all' ? 'All Upgrades' : KINDS[t].tab) + '<b>' + n + '</b></button>';
    }).join('');
    var bal = (o.balance ? '<div class="pm-bal">Balance <b>' + num(o.balance()).toLocaleString() + ' XC</b>' + (o.balanceNote ? ' · ' + esc(o.balanceNote) : '') + '</div>' : '');
    var list = itemsFor(m, m.tab), body;
    var note = m.tab === 'tax' ? '<p class="pm-note">The rules of the game. Taxes and fines come out of your X-Coin when their trigger happens, or when a host applies one. Only hosts can add or change them, in X-Coin.</p>'
      : m.tab === 'all' ? '<p class="pm-note">One marketplace, three kinds of upgrade. <b style="color:#4f8ef7">Platform</b> upgrades work everywhere, <b style="color:#ffd166">Game</b> upgrades power up Nexus Frontiers, <b style="color:#b388ff">Session</b> upgrades are redeemed in a live class.</p>' : '';
    if (!list.length) {
      var kk = m.tab === 'all' ? null : m.tab, loadedOk = kk && kk !== 'tax' ? d.ok[kk] : d.ok.platform;
      body = '<div class="pm-empty">' + (!m.loaded ? 'Loading…' : kk === 'game' && !d.ok.game ? 'Game upgrades show up here once a host opens Battle Arena.' : kk === 'tax' ? 'No taxes or fines published yet.' : 'Nothing here yet.') + '</div>';
    } else {
      var cards = list;
      body = '<div class="pm-grid">' + cards.map(function (it) { return cardHtml(it, o, m.id); }).join('') + '</div>';
    }
    return '<div class="pm">' + bal + '<div class="pm-tabs">' + bar + '</div>' + note + body + '</div>';
  }
  // paint into the attached element, or (apps that rebuild their DOM) into the element with opts.rootId
  function paint(m) {
    var el = m.el && m.el.isConnected !== false ? m.el : (m.opts.rootId && typeof document !== 'undefined' ? document.getElementById(m.opts.rootId) : null);
    if (el) { m.el = el; el.innerHTML = html(m); }
  }

  // create(): a persistent model for apps that rebuild their DOM often (Arena). attach(m, el) re-paints it into the new element.
  function create(opts) {
    ensureCss();
    var id = 'pm' + (++SEQ), m = { id: id, el: null, opts: opts || {}, tab: (opts && opts.tab) || null, data: { platform: [], game: [], session: [], tax: [], ok: {} }, loaded: false };
    MOUNTS[id] = m;
    m.refresh = function () {
      return load(m.opts.kv).then(function (d) { m.data = d; m.loaded = true; if (m.opts.afterLoad) { try { m.opts.afterLoad(d); } catch (e) {} } paint(m); return d; });
    };
    return m;
  }
  function attach(m, el) { m.el = el || null; paint(m); }
  function mount(el, opts) { var m = create(opts); attach(m, el); m.refresh(); return m; }
  function find(m, id) { var all = ORDER.reduce(function (a, k) { return a.concat(m.data[k]); }, []); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function act(el) {
    var mid = el.getAttribute('data-m'), arg = el.getAttribute('data-i'), what = el.getAttribute('data-w');
    var m = MOUNTS[mid]; if (!m) return;
    if (what === 'tab') { m.tab = arg; paint(m); return; }
    var it = find(m, arg); if (!it) return; var o = m.opts;
    if (what === 'buy' && o.buy && o.buy[it.kind]) { Promise.resolve(o.buy[it.kind](it, m)).then(function () { paint(m); }); }
    else if (what === 'goto' && o.goto) o.goto(it.home, { tab: it.kind, itemId: it.rawId, item: it });
    else if (what === 'edit') { if (o.app && it.home === o.app && o.edit) o.edit(it); else if (o.goto) o.goto(it.home, { tab: it.kind, itemId: it.rawId, edit: true, item: it }); }
  }

  root.PflxMarket = { version: 1, KINDS: KINDS, load: load, mount: mount, create: create, attach: attach, html: html, cardHtml: cardHtml, fromModifier: fromModifier, fromSession: fromSession, fromGame: fromGame, safeImg: safeImg, _act: act, _mounts: MOUNTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PflxMarket;
})(typeof window !== 'undefined' ? window : globalThis);
