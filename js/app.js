/* 魔法少女的魔女审判 · 开端（非官方同人）——纯静态、经典 script、零依赖 */
(function () {
  'use strict';
  var CHARS = window.CHARS, PLACES = window.PLACES, WORLD = window.WORLD, FACTIONS = window.FACTIONS,
      LINES = window.LINES;
  var KEY = 'manosaba.char.v1', PKEY = 'manosaba.pendingPortrait';

  /* ───────── 小工具 ───────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') for (var s in v) e.style.setProperty(s, v[s]);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids == null ? [] : [].concat(kids)).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 1900);
  }
  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return legacyCopy(txt); });
    }
    return Promise.resolve(legacyCopy(txt));
  }
  function legacyCopy(txt) {
    var ta = h('textarea', { style: { position: 'fixed', left: '-9999px', top: '0' } }); ta.value = txt;
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  }
  function openModal(node) {
    var c = $('#mcontent'); c.innerHTML = ''; c.appendChild(node); $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }

  /* ───────── 图片：多线路降级 + 超时 + 占位 ───────── */
  var STEAM_HOSTS = ['shared.akamai.steamstatic.com', 'shared.cdn.queniuam.com', 'shared.fastly.steamstatic.com'];
  function proxied(urlNoScheme, w) { return 'https://wsrv.nl/?url=' + encodeURIComponent(urlNoScheme) + (w ? '&w=' + w : '') + '&output=webp&q=85'; }
  function bgmCands(url) {
    var p = url.replace(/^https?:\/\//, '');
    return [url, proxied(p), 'https://images.weserv.nl/?url=' + encodeURIComponent(p) + '&output=webp&q=85'];
  }
  function steamCands(path, w) {
    var l = STEAM_HOSTS.map(function (hh) { return 'https://' + hh + '/' + path; });
    l.push(proxied(STEAM_HOSTS[0] + '/' + path, w || 1280));
    return l;
  }
  function pic(cands, alt, cls, opts) {
    opts = opts || {};
    var box = h('div', { class: 'imgbox ' + (cls || '') });
    if (!cands || !cands.length) { box.appendChild(h('div', { class: 'ph' }, ['（暂无图片）'])); return box; }
    var load = h('div', { class: 'load' }); box.appendChild(load);
    var img = h('img', { alt: alt || '', referrerpolicy: 'no-referrer', decoding: 'async' });
    if (opts.eager) img.loading = 'eager'; else img.loading = 'lazy';
    var i = 0, timer;
    function fail() {
      clearTimeout(timer); img.style.display = 'none'; load.remove();
      box.appendChild(h('div', { class: 'ph' }, ['图片暂时无法加载', h('a', { href: cands[0], target: '_blank', rel: 'noopener noreferrer' }, ['打开原图'])]));
    }
    function next() {
      clearTimeout(timer); i++;
      if (i >= cands.length) return fail();
      img.src = cands[i]; arm();
    }
    function arm() { timer = setTimeout(function () { if (!(img.complete && img.naturalWidth)) next(); }, 9000); }
    img.addEventListener('load', function () { clearTimeout(timer); load.remove(); });
    img.addEventListener('error', next);
    img.src = cands[0]; arm();
    box.appendChild(img);
    return box;
  }
  function charCands(c) { return bgmCands(c.img); }
  function charById(id) { for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i]; return null; }
  function placeById(id) { for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i]; return null; }
  function lineById(id) { for (var i = 0; i < LINES.length; i++) if (LINES[i].id === id) return LINES[i]; return null; }

  /* ───────── 标题页：等比缩放 / 音乐 ───────── */
  var bgv = $('#bgv');
  /* 三种显示：
     d  = 电脑 / 横向窗口：1270×720 画布等比缩放
     p  = 竖屏：背景铺满、人物按脸定位、标题在上按钮在下
     rot= 竖屏设备上点“横屏”：整页旋转 90°，按 d 的布局显示（沙盒 iframe 无法全屏 / 锁定方向时的兜底） */
  var rotated = false, titleSec = document.getElementById('title');
  function fit() {
    var vw = window.innerWidth, vh = window.innerHeight, root = document.documentElement;
    var portrait = (vw / vh <= 1.1) || vw < 600;
    if (!portrait) rotated = false;
    var mode = portrait && !rotated ? 'p' : 'd';
    var w = rotated ? vh : vw, hh = rotated ? vw : vh;
    var s = Math.min(w / 1270, hh / 720);
    root.style.setProperty('--s', s.toFixed(4));
    root.style.setProperty('--vw', vw + 'px'); root.style.setProperty('--vh', vh + 'px');
    if (titleSec) {
      titleSec.setAttribute('data-mode', mode);
      titleSec.classList.toggle('rot', rotated);
      titleSec.classList.toggle('land', !portrait);
      titleSec.classList.toggle('touch', !!(window.matchMedia && matchMedia('(pointer:coarse)').matches));
      var lb = titleSec.querySelector('.rotb span'); if (lb) lb.textContent = (rotated || !portrait) ? '竖屏' : '横屏';
    }
    var stg = document.getElementById('stage'); if (stg) { stg.scrollLeft = 0; stg.scrollTop = 0; }
    try { window.dispatchEvent(new Event('stagefit')); } catch (e) {}
  }
  function exitFs() { try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {} }
  function toggleRot() {
    var vw = window.innerWidth, vh = window.innerHeight, portrait = (vw / vh <= 1.1) || vw < 600;
    if (!portrait) { exitFs(); return; }                    // 已是横向（真横屏）：按钮变成“竖屏”，退出全屏
    if (rotated) { rotated = false; fit(); return; }
    // 先尝试真·横屏（普通网页里：全屏 + 锁定方向）；沙盒 iframe 不允许，就用旋转兜底
    var de = document.documentElement;
    if (document.fullscreenEnabled && de.requestFullscreen && screen.orientation && screen.orientation.lock) {
      de.requestFullscreen().then(function () { return screen.orientation.lock('landscape'); })
        .then(function () { setTimeout(fit, 250); }, function () { exitFs(); rotated = true; fit(); });
    } else { rotated = true; fit(); }
  }
  window.addEventListener('resize', fit); fit();
  var musicOn = false;
  function setMusic(on) {
    musicOn = on;
    if (on) { var p = bgv.play(); if (p && p.catch) p.catch(function () { musicOn = false; $$('[data-act=music]').forEach(function (b) { b.classList.remove('on'); }); }); }
    else bgv.pause();
    $$('[data-act=music]').forEach(function (b) { b.classList.toggle('on', on); });
  }
  function aboutModal() {
    openModal(h('div', { class: 'about' }, [
      h('h3', { text: '关于本站' }),
      h('p', { text: '这是一个非官方的同人互动网页，向《魔法少女ノ魔女裁判》（魔法少女的魔女审判）致敬。完全免费、没有任何形式的收益，与 Acacia / 合同会社 Re,AER 无任何关联，亦不代表官方立场。' }),
      h('h4', { text: '素材与出处' }),
      h('p', { html: '角色立绘外链自 <a href="https://bgm.tv/subject/488392/characters" target="_blank" rel="noopener">Bangumi 番组计划</a>；世界观配图为 Steam 商店页的官方宣传截图（外链）。本站不存储、不转载这些图片，若无法显示，请在官方渠道查看：<a href="https://manosaba.com/" target="_blank" rel="noopener">manosaba.com</a>、<a href="https://store.steampowered.com/app/3101040/" target="_blank" rel="noopener">Steam 商店页</a>。' }),
      h('p', { text: '标题页的开场画面是一段二次创作的短视频（改版自游戏主菜单风格）；人物与设定的著作权归原作者所有，若权利方提出异议，将立即撤下相关内容。' }),
      h('h4', { text: '设定来源' }),
      h('p', { text: '人物、地点与世界观文本整理自一张公开的世界卡设定集，并以官方公开资料（生日、身高体重、原罪与魔法等）校对；立绘外观描述以官方立绘为准。涉及剧透，请自行留意。' }),
      h('h4', { text: '存档说明' }),
      h('p', { text: '“保存”只会写入你自己浏览器的本地存储，不会上传到任何服务器；清理浏览器数据会丢失存档，建议使用“创造答案”把设定复制保存。' })
    ]));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (b) {
      var a = b.getAttribute('data-act');
      if (a === 'music') setMusic(!musicOn);
      else if (a === 'rot') toggleRot();
      else if (a === 'about') aboutModal();
      else if (a === 'load') { if (loadSaved()) { go('#/create'); toast('已读取存档'); } else toast('还没有存档，先去创造一个角色吧'); }
    }
    // 沙盒 iframe（srcdoc）里的页内锚点不一定可靠：自己接管 “#/…” 链接
    var lk = e.target.closest && e.target.closest('a[href^="#/"]');
    if (lk && embedded) { e.preventDefault(); go(lk.getAttribute('href')); }
    if (e.target.closest('.mclose') || e.target === $('#modal')) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ───────── 存档 ───────── */
  var state = blank();
  function blank() {
    return { name: '', gender: '女', genderCustom: '', pers: '', tags: [], witch: true, magicName: '', magicDesc: '', magicLimit: '', sin: '',
      identity: '', line: 'l1', place: 'cells', look: '', bg: '', portrait: { type: '', value: '', label: '' } };
  }
  function loadSaved() {
    try { var s = localStorage.getItem(KEY); if (!s) return false; var o = JSON.parse(s); state = Object.assign(blank(), o); return true; }
    catch (e) { return false; }
  }
  function doSave() {
    try {
      state.savedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state)); return true;
    } catch (e) { return false; }
  }

  /* ───────── 路由 ───────── */
  var titleEl = $('#title'), pageEl = $('#page'), viewEl = $('#view');
  var curHash = embedded0() ? '#/' : (location.hash || '#/');
  function embedded0() { try { return window.top !== window.self; } catch (e) { return true; } }
  var embedded = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
  function go(h) {
    curHash = h || '#/';
    if (!embedded && (location.hash || '#/') !== curHash) { location.hash = curHash; return; }   // 独立网页：走浏览器历史
    route();                                                                                       // 嵌在卡片里：自己切换
  }
  function route() {
    var hash = curHash || '#/'; var parts = hash.replace(/^#\/?/, '').split('/');
    var name = parts[0] || '';
    closeModal();
    if (!name) {
      titleEl.hidden = false; pageEl.hidden = true; document.title = '魔法少女的魔女审判 · 开端（非官方同人网页）';
      return;
    }
    titleEl.hidden = true; pageEl.hidden = false; window.scrollTo(0, 0);
    $$('.tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-t') === name); });
    viewEl.innerHTML = '';
    if (name === 'create') { consumePending(); viewEl.appendChild(renderCreate()); document.title = '创造角色 · 魔女审判开端'; }
    else if (name === 'roster') {
      if (parts[1] && charById(parts[1])) { viewEl.appendChild(renderDetail(charById(parts[1]))); document.title = charById(parts[1]).cn + ' · 角色图鉴'; }
      else { viewEl.appendChild(renderRoster()); document.title = '角色图鉴 · 魔女审判开端'; }
    }
    else if (name === 'world') { viewEl.appendChild(renderWorld()); document.title = '世界观介绍 · 魔女审判开端'; }
    else go('#/');
    try { window.dispatchEvent(new Event('routed')); } catch (e) {}
  }
  window.addEventListener('hashchange', function () { curHash = location.hash || '#/'; route(); });

  function consumePending() {
    try {
      var p = sessionStorage.getItem(PKEY);
      if (p) { var o = JSON.parse(p); state.portrait = o; sessionStorage.removeItem(PKEY); state._dirty = true; }
    } catch (e) {}
  }

  /* ───────── 创造角色 ───────── */
  var PERS_TAGS = ['开朗', '内向', '冷静', '毒舌', '温柔', '傲娇', '正义感强', '胆小', '电波', '好奇心旺盛', '偏执', '嘴硬心软', '不信任他人', '爱撒谎', '重情义', '自卑', '乐天派', '洁癖'];
  function renderCreate() {
    var root = h('div', { class: 'create' });
    var dirty = false;
    var stateEl = h('span', { class: 'state' });
    function setDirty(d) {
      dirty = d;
      if (d) { stateEl.className = 'state dirty'; stateEl.textContent = '有未保存的修改'; }
      else { stateEl.className = 'state ok'; stateEl.textContent = state.savedAt ? '已保存 · ' + new Date(state.savedAt).toLocaleTimeString() : ''; }
    }
    if (state._dirty) { delete state._dirty; dirty = true; }

    /* 左：立绘 */
    var capName = h('div', { class: 'cap' }), pbox = h('div'), pinfo = h('small');
    function paintPortrait() {
      pbox.innerHTML = ''; var p = state.portrait || {};
      var node;
      if (p.type === 'data') node = pic([p.value], '角色立绘', 'contain', { eager: true });
      else if (p.type === 'official') { var c = charById(p.value); node = c ? pic(charCands(c), c.cn, 'contain', { eager: true }) : pic([]); }
      else if (p.type === 'url') node = pic([p.value], '角色立绘', 'contain', { eager: true });
      else node = h('div', { class: 'imgbox' }, [h('div', { class: 'ph', html: '<b style="font-size:42px;opacity:.5">?</b>在这里放入立绘<br>可本地上传、粘贴外部图片链接<br>或从图鉴里选一位' })]);
      pbox.appendChild(node);
      capName.textContent = state.name || '（未命名）';
      pinfo.textContent = p.type === 'data' ? '本地上传（仅保存在你的浏览器）' : p.type === 'url' ? '外部图片链接' : p.type === 'official' ? '图鉴立绘（外链）' : '尚未设置立绘';
      capName.innerHTML = ''; capName.appendChild(document.createTextNode(state.name || '（未命名）')); capName.appendChild(pinfo);
    }
    var file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var max = 900, r = Math.min(1, max / Math.max(im.width, im.height));
          var cv = document.createElement('canvas'); cv.width = Math.round(im.width * r); cv.height = Math.round(im.height * r);
          var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height);
          var data; try { data = cv.toDataURL('image/webp', .85); if (data.indexOf('image/webp') < 0) data = cv.toDataURL('image/jpeg', .85); } catch (e) { data = fr.result; }
          state.portrait = { type: 'data', value: data }; setDirty(true); paintPortrait(); toast('立绘已载入');
        };
        im.onerror = function () { toast('这张图片无法读取'); };
        im.src = fr.result;
      };
      fr.readAsDataURL(f); file.value = '';
    });
    var urlIn = h('input', { type: 'text', placeholder: '粘贴外部图片链接（https://…）' });
    var offSel = h('select', null, [h('option', { value: '' }, ['从角色图鉴选一位…'])].concat(CHARS.map(function (c) { return h('option', { value: c.id }, [c.cn + '（' + c.jp + '）']); })));
    offSel.addEventListener('change', function () { if (!offSel.value) return; state.portrait = { type: 'official', value: offSel.value }; setDirty(true); paintPortrait(); offSel.value = ''; });
    var presets = h('div', { class: 'presets' }, [h('div', { class: 'ptitle' }, ['预设主角 · 点一下填入'])]);
    var prow = h('div', { class: 'phero' });
    (window.HEROES || []).forEach(function (hr) {
      prow.appendChild(h('button', { class: 'ph1', type: 'button', title: hr.name + '（' + hr.gender + '，' + hr.age + '岁）', onclick: function () {
        var keep = state.savedAt;
        state = Object.assign(blank(), { name: hr.name, gender: hr.gender, pers: hr.pers, tags: hr.tags.slice(), witch: true, magicName: hr.magic, magicDesc: hr.magicDesc,
          magicLimit: hr.magicLimit, sin: hr.sin, identity: '', look: hr.look, bg: hr.identity, portrait: { type: 'url', value: hr.img, label: hr.name }, _dirty: true, savedAt: keep });
        go('#/create'); toast('已填入「' + hr.name + '」，可以继续修改');
      } }, [h('img', { src: hr.av, alt: hr.name, draggable: 'false' }), h('b', { text: hr.name })]));
    });
    presets.appendChild(prow);
    var left = h('aside', { class: 'portrait' }, [
      presets, pbox, capName,
      h('div', { class: 'prow' }, [
        h('button', { class: 'btn sm', onclick: function () { file.click(); } }, ['本地上传']),
        h('button', { class: 'btn sm ghost', onclick: function () { state.portrait = { type: '', value: '' }; setDirty(true); paintPortrait(); } }, ['清除'])
      ]),
      h('div', { class: 'prow' }, [urlIn, h('button', { class: 'btn sm pink', onclick: function () {
        var u = urlIn.value.trim();
        if (!/^https?:\/\//i.test(u)) { toast('请输入以 http(s):// 开头的图片链接'); return; }
        state.portrait = { type: 'url', value: u }; setDirty(true); paintPortrait(); urlIn.value = '';
      } }, ['载入'])]),
      h('div', { class: 'prow' }, [offSel]),
      h('p', { class: 'hint' }, ['立绘放在左边，方便你边看边填。本地图片会被压缩后只存进你自己的浏览器；外链图片请确认对方允许引用。']),
      file
    ]);
    paintPortrait();

    /* 右：表单 */
    var right = h('div');

    // 姓名/性别
    var nameIn = h('input', { type: 'text', maxlength: 24, placeholder: '你的角色叫什么？', value: state.name });
    nameIn.addEventListener('input', function () { state.name = nameIn.value; setDirty(true); capName.firstChild.nodeValue = state.name || '（未命名）'; });
    var genderChips = h('div', { class: 'chips' });
    var genderOther = h('input', { type: 'text', maxlength: 12, placeholder: '自定义性别', value: state.genderCustom, style: { display: state.gender === '其他' ? '' : 'none', marginTop: '8px' }, class: 'inp' });
    genderOther.addEventListener('input', function () { state.genderCustom = genderOther.value; setDirty(true); });
    ['女', '男', '其他'].forEach(function (g) {
      var c = h('button', { class: 'chip' + (state.gender === g ? ' on' : ''), type: 'button', onclick: function () {
        state.gender = g; $$('.chip', genderChips).forEach(function (x) { x.classList.toggle('on', x === c); });
        genderOther.style.display = g === '其他' ? '' : 'none'; setDirty(true);
      } }, [g]); genderChips.appendChild(c);
    });
    right.appendChild(h('section', { class: 'sec' }, [
      h('h2', null, ['基本信息']),
      h('div', { class: 'two' }, [
        h('div', { class: 'f' }, [h('label', null, ['姓名']), nameIn]),
        h('div', { class: 'f' }, [h('label', null, ['性别']), genderChips, genderOther])
      ])
    ]));

    // 性格
    var persIn = h('textarea', { placeholder: '用几句话描述 TA 的性格：外表如何，内心如何，害怕什么，想守护什么？' }); persIn.value = state.pers;
    persIn.addEventListener('input', function () { state.pers = persIn.value; setDirty(true); });
    var tagBox = h('div', { class: 'chips' });
    PERS_TAGS.forEach(function (t) {
      var c = h('button', { class: 'chip' + (state.tags.indexOf(t) >= 0 ? ' on' : ''), type: 'button', onclick: function () {
        var i = state.tags.indexOf(t); if (i >= 0) state.tags.splice(i, 1); else state.tags.push(t);
        c.classList.toggle('on', i < 0); setDirty(true);
      } }, [t]); tagBox.appendChild(c);
    });
    right.appendChild(h('section', { class: 'sec' }, [
      h('h2', null, ['性格', h('small', null, ['标签可多选，再补充几句描述'])]),
      tagBox, h('div', { class: 'f', style: { marginTop: '12px', marginBottom: 0 } }, [persIn])
    ]));

    // 身份
    var witchChips = h('div', { class: 'chips' });
    var witchBox = h('div', { class: 'witch-box' }), idBox = h('div', { class: 'f', style: { marginBottom: 0 } });
    function paintIdentity() {
      witchBox.style.display = state.witch ? '' : 'none'; idBox.style.display = state.witch ? 'none' : '';
    }
    [['魔女（魔女因子觉醒者）', true], ['不是魔女', false]].forEach(function (a) {
      var c = h('button', { class: 'chip' + (state.witch === a[1] ? ' on' : ''), type: 'button', onclick: function () {
        state.witch = a[1]; $$('.chip', witchChips).forEach(function (x) { x.classList.toggle('on', x === c); }); paintIdentity(); setDirty(true);
      } }, [a[0]]); witchChips.appendChild(c);
    });
    var magicSel = h('select', null, [h('option', { value: '' }, ['参考原著十三种魔法（选一个填入名称）…'])].concat(CHARS.filter(function (c) { return c.no !== '—'; }).map(function (c) { return h('option', { value: c.magic }, [c.magic + '（' + c.cn + '）']); })));
    var mName = h('input', { type: 'text', maxlength: 24, placeholder: '魔法的名字，如：视线诱导', value: state.magicName });
    var mDesc = h('textarea', { placeholder: '魔法的效果：能做到什么？怎样发动？' }); mDesc.value = state.magicDesc;
    var mLim = h('textarea', { placeholder: '限制与代价：什么时候会失效？每次使用会失去什么？' }); mLim.value = state.magicLimit;
    var sinIn = h('input', { type: 'text', maxlength: 40, placeholder: '原罪（选填），如：受厌恶之人', value: state.sin });
    magicSel.addEventListener('change', function () { if (magicSel.value) { mName.value = magicSel.value; state.magicName = magicSel.value; setDirty(true); magicSel.value = ''; } });
    mName.addEventListener('input', function () { state.magicName = mName.value; setDirty(true); });
    mDesc.addEventListener('input', function () { state.magicDesc = mDesc.value; setDirty(true); });
    mLim.addEventListener('input', function () { state.magicLimit = mLim.value; setDirty(true); });
    sinIn.addEventListener('input', function () { state.sin = sinIn.value; setDirty(true); });
    witchBox.appendChild(h('div', { class: 'f' }, [h('label', null, ['魔法']), magicSel, mName]));
    witchBox.appendChild(h('div', { class: 'f' }, [h('label', null, ['魔法效果']), mDesc]));
    witchBox.appendChild(h('div', { class: 'f' }, [h('label', null, ['限制与代价']), mLim]));
    witchBox.appendChild(h('div', { class: 'f', style: { marginBottom: 0 } }, [h('label', null, ['原罪']), sinIn]));
    var idIn = h('textarea', { placeholder: '不是魔女时，TA 是什么人？例如：被误抓的普通人、看守、外部的政府人员、记者…' }); idIn.value = state.identity;
    idIn.addEventListener('input', function () { state.identity = idIn.value; setDirty(true); });
    idBox.appendChild(h('label', null, ['身份说明'])); idBox.appendChild(idIn);
    paintIdentity();
    right.appendChild(h('section', { class: 'sec' }, [
      h('h2', null, ['身份', h('small', null, ['是否为魔女？若是，填写 TA 的魔法'])]),
      witchChips, h('div', { style: { height: '10px' } }), witchBox, idBox
    ]));

    // 外貌 / 背景（选填）
    var lookIn = h('textarea', { placeholder: '外貌（选填）：发色、瞳色、身高、服饰、标志性的小物件…' }); lookIn.value = state.look;
    var bgIn = h('textarea', { placeholder: '背景（选填）：入狱前的生活，被检出魔女因子的经过…' }); bgIn.value = state.bg;
    lookIn.addEventListener('input', function () { state.look = lookIn.value; setDirty(true); });
    bgIn.addEventListener('input', function () { state.bg = bgIn.value; setDirty(true); });
    right.appendChild(h('section', { class: 'sec' }, [
      h('h2', null, ['外貌与背景', h('small', null, ['选填'])]),
      h('div', { class: 'f' }, [lookIn]), h('div', { class: 'f', style: { marginBottom: 0 } }, [bgIn])
    ]));

    // 开局线 + 地点
    var lineSel = h('select', null, LINES.map(function (l) { return h('option', { value: l.id }, [l.n]); })); lineSel.value = state.line;
    var lineDesc = h('p', { class: 'place-desc', style: { marginTop: '6px' } });
    function paintLine() { var l = lineById(state.line); lineDesc.textContent = l ? l.d : ''; }
    lineSel.addEventListener('change', function () { state.line = lineSel.value; paintLine(); setDirty(true); }); paintLine();
    var placeWrap = h('div'), placeDesc = h('div', { class: 'place-desc' });
    function paintPlaceDesc() { var p = placeById(state.place); placeDesc.innerHTML = ''; if (p) { placeDesc.appendChild(h('b', { text: p.n + '（' + p.jp + '）' })); placeDesc.appendChild(h('div', { text: p.d, style: { marginTop: '4px' } })); } }
    var lastFl = '', grid;
    PLACES.forEach(function (p) {
      if (p.fl !== lastFl) { lastFl = p.fl; placeWrap.appendChild(h('div', { class: 'floor', text: '— ' + p.fl + ' —' })); grid = h('div', { class: 'places' }); placeWrap.appendChild(grid); }
      var b = h('button', { class: 'place' + (state.place === p.id ? ' on' : ''), type: 'button', 'data-id': p.id, onclick: function () {
        state.place = p.id; $$('.place', placeWrap).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-id') === p.id); }); paintPlaceDesc(); setDirty(true);
      } }, [h('b', { text: p.n }), h('small', { text: p.jp })]);
      grid.appendChild(b);
    });
    paintPlaceDesc();
    right.appendChild(h('section', { class: 'sec' }, [
      h('h2', null, ['开局地点', h('small', null, ['选择故事开始时 TA 所在的位置'])]),
      h('div', { class: 'f' }, [h('label', null, ['开局时间线']), lineSel, lineDesc]), placeWrap, placeDesc
    ]));

    // 操作栏
    var saveBtn = h('button', { class: 'btn', type: 'button', onclick: function () {
      if (doSave()) { setDirty(false); toast('已保存'); } else toast('保存失败：浏览器存储已满或被禁用，请使用“创造答案”复制保存');
    } }, ['保存']);
    var ansBtn = h('button', { class: 'btn pink', type: 'button', onclick: function () { showAnswer(); } }, ['创造答案']);
    var resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: function () {
      if (!confirm('清空当前所有填写内容？（不会删除已保存的存档，除非你再点“保存”）')) return;
      state = blank(); route();
    } }, ['重置']);
    var rosterBtn = h('a', { class: 'btn ghost', href: '#/roster' }, ['去看图鉴']);
    right.appendChild(h('div', { class: 'actbar' }, [stateEl, rosterBtn, resetBtn, saveBtn, ansBtn]));
    setDirty(dirty);
    if (!dirty && !state.savedAt) stateEl.textContent = '尚未保存';

    root.appendChild(left); root.appendChild(right);
    var head = h('div', null, [h('h1', { class: 'pt', html: '创造<em>角色</em>' }), h('p', { class: 'sub', text: '填写你的囚犯：姓名、性别、性格、身份与开局地点。点“保存”即存入本机，点“创造答案”会弹出整理好的完整设定，点击即可复制。' })]);
    var wrap = h('div'); wrap.appendChild(head); wrap.appendChild(root); return wrap;
  }

  function buildAnswer() {
    var s = state, L = [], g = s.gender === '其他' ? (s.genderCustom || '其他') : s.gender;
    var pl = placeById(s.place), ln = lineById(s.line);
    function v(x) { return (x && String(x).trim()) || '（未填写）'; }
    L.push('【角色设定 · 魔法少女的魔女审判】');
    L.push('姓名：' + v(s.name));
    L.push('性别：' + g);
    L.push('性格：' + (s.tags.length ? '[' + s.tags.join('、') + '] ' : '') + (s.pers.trim() || (s.tags.length ? '' : '（未填写）')));
    if (s.witch) {
      L.push('身份：魔女（体内魔女因子已觉醒）');
      L.push('魔法：' + v(s.magicName));
      if (s.magicDesc.trim()) L.push('魔法效果：' + s.magicDesc.trim());
      if (s.magicLimit.trim()) L.push('限制与代价：' + s.magicLimit.trim());
      if (s.sin.trim()) L.push('原罪：' + s.sin.trim());
    } else {
      L.push('身份：非魔女' + (s.identity.trim() ? '——' + s.identity.trim() : ''));
    }
    if (s.look.trim()) L.push('外貌：' + s.look.trim());
    if (s.bg.trim()) L.push('背景：' + s.bg.trim());
    L.push('开局时间线：' + (ln ? ln.n : ''));
    L.push('开局地点：' + (pl ? pl.n + '（' + pl.jp + '）' : '（未选择）'));
    var p = s.portrait || {};
    if (p.type === 'url') L.push('立绘：' + p.value);
    else if (p.type === 'official') { var c = charById(p.value); L.push('立绘：图鉴立绘 · ' + (c ? c.cn + '（' + c.img + '）' : '')); }
    else if (p.type === 'data') L.push('立绘：（本地上传的图片，无法随文字复制）');
    return L.join('\n');
  }
  function showAnswer() {
    var txt = buildAnswer();
    var box = h('div', { class: 'answer', title: '点击复制全部', text: txt });
    var okEl = h('span', { class: 'ok' });
    function doCopy() { copyText(txt).then(function (ok) { okEl.textContent = ok ? '已复制到剪贴板 ✓' : '复制失败，请手动全选复制'; toast(ok ? '已复制' : '复制失败，请手动选中复制'); }); }
    box.addEventListener('click', doCopy);
    var warn = [];
    if (!state.name.trim()) warn.push('姓名'); if (!state.pers.trim() && !state.tags.length) warn.push('性格'); if (state.witch && !state.magicName.trim()) warn.push('魔法');
    openModal(h('div', null, [
      h('h3', { text: '创造答案' }),
      h('p', { class: 'hint', text: '这是你全部填写好的设定。点击下面的文字框（或“复制”按钮）即可复制全部内容。' + (warn.length ? '　提示：还没填 ' + warn.join('、') + '。' : '') }),
      box,
      h('div', { class: 'mact' }, [h('button', { class: 'btn', onclick: doCopy }, ['复制全部']), h('button', { class: 'btn ghost', onclick: function () { if (doSave()) { toast('已保存'); } } }, ['同时保存']), okEl])
    ]));
  }

  /* ───────── 角色图鉴 ───────── */
  function renderRoster() {
    var wrap = h('div'); var tab = 'all';
    var grid = h('div', { class: 'rgrid' }), tabs = h('div', { class: 'rtabs' });
    function list() { return CHARS.filter(function (c) { return tab === 'all' || (tab === 'pris' && c.no !== '—') || (tab === 'other' && c.no === '—'); }); }
    function paint() {
      grid.innerHTML = '';
      list().forEach(function (c) {
        grid.appendChild(h('a', { class: 'rc', href: '#/roster/' + c.id, style: { '--c': c.color } }, [
          h('div', { style: { position: 'relative' } }, [pic(charCands(c), c.cn, ''), h('span', { class: 'no', text: c.no === '—' ? '' : c.no })]),
          h('div', { class: 'meta' }, [h('div', { class: 'nm', text: c.cn }), h('div', { class: 'jp', text: c.jp }), h('div', { class: 'sn' }, [c.magic !== '—' ? h('span', null, ['魔法 ', h('b', { text: c.magic })]) : h('span', { text: c.magicJp })])])
        ]));
      });
    }
    [['all', '全部 ' + CHARS.length], ['pris', '十三位囚犯 13'], ['other', '月代雪 / 典狱长 / 看守']].forEach(function (t) {
      var b = h('button', { class: 'chip' + (tab === t[0] ? ' on' : ''), type: 'button', onclick: function () { tab = t[0]; $$('.chip', tabs).forEach(function (x) { x.classList.toggle('on', x === b); }); paint(); } }, [t[1]]); tabs.appendChild(b);
    });
    wrap.appendChild(h('h1', { class: 'pt', html: '角色<em>图鉴</em>' }));
    wrap.appendChild(h('p', { class: 'sub', text: '十三位囚犯、大魔女月代雪、典狱长与看守。立绘为官方原画（外链自 Bangumi），资料对照官方公开信息与世界卡设定集整理，含剧透。' }));
    wrap.appendChild(tabs); wrap.appendChild(grid); paint(); return wrap;
  }
  function renderDetail(c) {
    var idx = CHARS.indexOf(c), prev = CHARS[(idx + CHARS.length - 1) % CHARS.length], next = CHARS[(idx + 1) % CHARS.length];
    var facts = [['囚犯编号', c.no], ['声优', c.cv], ['生日', c.bd], ['血型', c.blood === '—' ? '—' : c.blood + ' 型'], ['身高', c.h], ['体重', c.w], ['原罪', c.sin], ['魔法', c.magic !== '—' ? c.magic : c.magicJp]];
    var f = h('div', { class: 'facts' }, facts.filter(function (x) { return x[1] && x[1] !== '—'; }).map(function (x) { return h('div', { class: 'fact' }, [h('small', { text: x[0] }), h('b', { text: x[1] })]); }));
    function sec(t, body) { return h('div', { class: 'dsec' }, [h('h3', { text: t }), h('p', { text: body })]); }
    var right = h('div', null, [
      h('div', { class: 'dname' }, [h('h1', { text: c.cn }), h('div', { class: 'jp', text: c.jp + ' · ' + c.rom })]),
      h('div', { class: 'dquote', text: c.quote }), f,
      c.magic !== '—' ? sec('魔法', c.magic + '（' + c.magicJp + '）') : (c.magicJp !== '—' ? sec('定位', c.magicJp) : null),
      sec('外貌', c.look), sec('性格', c.pers), sec('背景', c.past), sec('口癖与说话方式', c.speech), sec('人物关系', c.rel), sec('时间线', c.line), sec('结局', c.end),
      h('div', { class: 'links' }, [
        h('a', { class: 'btn sm ghost', href: 'https://bgm.tv/character/' + c.bgm, target: '_blank', rel: 'noopener' }, ['Bangumi 角色页']),
        h('a', { class: 'btn sm ghost', href: 'https://manosaba.com/#character', target: '_blank', rel: 'noopener' }, ['官方站 · 角色'])
      ]),
      h('div', { class: 'dnav' }, [
        h('a', { class: 'btn ghost', href: '#/roster/' + prev.id }, ['‹ ' + prev.cn]),
        h('a', { class: 'btn ghost', href: '#/roster' }, ['返回图鉴']),
        h('a', { class: 'btn ghost', href: '#/roster/' + next.id }, [next.cn + ' ›']),
        c.no !== '—' ? h('button', { class: 'btn pink', onclick: function () {
          try { sessionStorage.setItem(PKEY, JSON.stringify({ type: 'official', value: c.id })); } catch (e) {}
          go('#/create');
        } }, ['以 TA 的立绘创造角色']) : null
      ])
    ]);
    return h('div', { class: 'detail', style: { '--c': c.color } }, [h('div', { class: 'dart' }, [pic(charCands(c), c.cn, 'contain', { eager: true })]), right]);
  }

  /* ───────── 世界观 ───────── */
  function renderWorld() {
    var wrap = h('div'); wrap.appendChild(h('h1', { class: 'pt', html: '世界观<em>介绍</em>' }));
    wrap.appendChild(h('p', { class: 'sub', text: '牢屋敷、魔女因子、残骸、五大铁则与三个周目。配图为 Steam 商店页的官方截图（外链），文字含剧透。' }));
    var lay = h('div', { class: 'wlayout' }), idx = h('nav', { class: 'windex' }), body = h('div');
    function add(id, title) { idx.appendChild(h('a', { href: '#/world', onclick: function (e) { e.preventDefault(); var t = document.getElementById('w-' + id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, [title])); }
    WORLD.forEach(function (w) {
      add(w.id, w.title);
      var s = h('section', { class: 'wsec', id: 'w-' + w.id }, [h('h2', { text: w.title })]);
      if (w.img) s.appendChild(h('figure', { class: 'wfig' }, [pic(steamCands(w.img), w.cap, ''), h('figcaption', { text: w.cap })]));
      w.body.forEach(function (p) { s.appendChild(h('p', { text: p })); });
      body.appendChild(s);
    });
    add('places', '十九处地点');
    var ps = h('section', { class: 'wsec', id: 'w-places' }, [h('h2', { text: '十九处地点' })]), pg = h('div', { class: 'pgrid' });
    PLACES.forEach(function (p) {
      pg.appendChild(h('article', { class: 'pc' }, [p.img ? pic(steamCands(p.img, 800), p.n, '') : null, h('div', { class: 'pb' }, [h('h4', null, [p.n, h('small', { text: p.fl + ' · ' + p.jp })]), h('p', { text: p.d })])]));
    });
    ps.appendChild(pg); body.appendChild(ps);
    add('fac', '势力与派系');
    var fs = h('section', { class: 'wsec', id: 'w-fac' }, [h('h2', { text: '势力与派系' })]), fg = h('div', { class: 'fgrid' });
    FACTIONS.forEach(function (f) { fg.appendChild(h('div', { class: 'fc' }, [h('h4', { text: f.n }), h('div', { class: 'm', text: f.m }), h('p', { text: f.t })])); });
    fs.appendChild(fg); body.appendChild(fs);
    lay.appendChild(idx); lay.appendChild(body); wrap.appendChild(lay); return wrap;
  }

  /* ───────── 启动 ───────── */
  loadSaved();
  route();
})();
