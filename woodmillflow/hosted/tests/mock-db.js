// Stand-in for the artifact db capability that mirrors the real platform's behaviour:
// - one store shared by every browser session (served by the test runner at /__db)
// - snapshot data() objects are deeply FROZEN, as the platform documents
// - onSnapshot delivers changes from other sessions (polling)
(function () {
  function deepFreeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; }
  function call(body) {
    return fetch('/__db', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r.error) throw r.error; return r.result; });
  }
  function snapDoc(id, data) {
    var frozen = data ? deepFreeze(JSON.parse(JSON.stringify(data))) : undefined;
    return Object.freeze({ id: id, exists: !!data, data: function () { return frozen; }, metadata: { fromCache: false, hasPendingWrites: false } });
  }
  function query(coll, ord, lim) {
    function run() {
      return call({ op: 'list', coll: coll }).then(function (rows) {
        var docs = rows.map(function (r) { return snapDoc(r.id, r.data); });
        if (ord) docs.sort(function (a, b) { var x = a.data()[ord[0]], y = b.data()[ord[0]]; return (x < y ? -1 : x > y ? 1 : 0) * (ord[1] === 'desc' ? -1 : 1); });
        if (lim) docs = docs.slice(0, lim);
        return Object.freeze({ docs: docs, size: docs.length, empty: !docs.length, metadata: {} });
      });
    }
    return {
      orderBy: function (f, dir) { return query(coll, [f, dir || 'asc'], lim); },
      limit: function (n) { return query(coll, ord, n); },
      get: run,
      onSnapshot: function (next, onErr) {
        var last = null, stopped = false;
        function tick() {
          if (stopped) return;
          run().then(function (s) {
            var key = JSON.stringify(s.docs.map(function (d) { return [d.id, d.data()]; }));
            if (key !== last) { last = key; next(s); }
          }, function (e) { if (onErr) onErr(e); }).finally(function () { setTimeout(tick, 400); });
        }
        setTimeout(tick, 20);
        return function () { stopped = true; };
      },
      doc: function (id) { return docRef(coll + '/' + id); }
    };
  }
  function docRef(path) {
    return {
      id: path.split('/').pop(), path: path,
      get: function () { return call({ op: 'get', path: path }).then(function (d) { return snapDoc(path.split('/').pop(), d); }); },
      set: function (d) { return call({ op: 'set', path: path, data: d }); },
      update: function (d) { return call({ op: 'update', path: path, data: d }); },
      delete: function () { return call({ op: 'delete', path: path }); }
    };
  }
  var db = Object.freeze({ collection: function (c) { return query(c); }, doc: docRef });
  var downloads = Object.freeze({ save: function (r) { window.__saved = r; return Promise.resolve({ status: 'saved' }); } });
  window.claude = { use: function (n) { return new Promise(function (res) { setTimeout(function () { res(n === 'db' ? db : n === 'downloads' ? downloads : null); }, 30); }); } };
})();
