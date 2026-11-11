/* JOBReady 화면 디자인 · 브라우저 미리보기용 실행기
   각 화면(.html)에 들어 있는 화면 트리(window.__DC_TREE)와 화면 로직(window.__DC_COMPONENT)을
   Preact로 그려 줍니다. 디자인 캔버스 밖에서도 링크 · 버튼 · 입력이 동작하도록 만든 단순한 실행기입니다. */
(function () {
  var h = window.preact.h, render = window.preact.render;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, next || {});
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  var inst = null, root = null, tree = null, queued = false;

  function schedule() {
    if (queued || !inst) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; draw(); });
  }

  function lookup(path, scopes) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    var first = parts[0], cur;
    for (var i = 0; i < scopes.length; i++) {
      var sc = scopes[i];
      if (sc && typeof sc === 'object' && first in sc) { cur = sc[first]; break; }
    }
    for (var j = 1; j < parts.length; j++) {
      if (cur == null) return undefined;
      cur = cur[parts[j]];
    }
    return cur;
  }

  var WHOLE = /^\s*\{\{([^{}]+)\}\}\s*$/;
  var ANY = /\{\{([^{}]+)\}\}/g;
  function interp(str, scopes) {
    return str.replace(ANY, function (_, p) { var v = lookup(p, scopes); return v == null ? '' : String(v); });
  }
  function attrVal(str, scopes) {
    var m = WHOLE.exec(str);
    if (m) return lookup(m[1], scopes);
    if (str.indexOf('{{') >= 0) return interp(str, scopes);
    return str;
  }

  function build(node, scopes) {
    if (typeof node === 'string') return node.indexOf('{{') >= 0 ? interp(node, scopes) : node;
    var tag = node.t, a = node.a || {}, kids = node.c || [];
    if (tag === 'sc-if') {
      return attrVal(a.value || '', scopes) ? buildKids(kids, scopes) : null;
    }
    if (tag === 'sc-for') {
      var list = attrVal(a.list || '', scopes) || [];
      var as = a.as || 'item', out = [];
      for (var i = 0; i < list.length; i++) {
        var sc = { $index: i }; sc[as] = list[i];
        out.push(buildKids(kids, [sc].concat(scopes)));
      }
      return out;
    }
    var props = {};
    var lower = tag.toLowerCase();
    var textLike = (lower === 'input' && !/^(checkbox|radio|file)$/i.test(a.type || '')) || lower === 'textarea';
    for (var k in a) {
      if (k.indexOf('hint-') === 0) continue;
      var v = attrVal(a[k], scopes);
      if (v === undefined || v === null) continue;
      var name = k;
      if (/^on[A-Z]/.test(k)) {
        if (typeof v !== 'function') continue;
        if (k === 'onChange' && textLike) name = 'onInput';
      }
      props[name] = v;
    }
    return h(tag, props, buildKids(kids, scopes));
  }
  function buildKids(kids, scopes) {
    var out = [];
    for (var i = 0; i < kids.length; i++) { var r = build(kids[i], scopes); if (r !== null && r !== undefined) out.push(r); }
    return out;
  }

  function draw() {
    var vals = inst.renderVals ? inst.renderVals() : {};
    render(h('div', { style: 'display: contents' }, buildKids(tree, [vals])), root);
  }

  window.__dcStart = function () {
    tree = window.__DC_TREE;
    root = document.getElementById('dc-root');
    var props = Object.assign({}, window.__DC_DEFAULTS || {});
    try {
      new URLSearchParams(location.search).forEach(function (v, k) { props[k] = v; });
    } catch (e) {}
    var C = window.__DC_COMPONENT;
    inst = new C(props);
    if (!inst.state) inst.state = {};
    draw();
    if (inst.componentDidMount) { try { inst.componentDidMount(); } catch (e) {} }
  };
})();
