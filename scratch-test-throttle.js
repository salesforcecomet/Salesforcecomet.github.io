// Standalone test of the throttled publish/persist logic extracted from
// background.js. We replicate the exact throttling functions and drive them
// with rapid calls, asserting storage-write counts stay bounded and the
// final state always lands.
const SFIR_PUBLISH_INTERVAL_MS = 600;
const SFIR_PERSIST_INTERVAL_MS = 15000;

function makeEngine() {
  let publishWrites = 0;
  let persistWrites = 0;
  let publishLastAt = 0;
  let publishTimer = null;
  let publishQueued = null;
  let persistTimer = null;
  let persistLastAt = 0;
  let persistPending = false;

  const api = {
    get publishWrites() { return publishWrites; },
    get persistWrites() { return persistWrites; }
  };

  // --- publish (mirrors sfirImportPublish throttle) ---
  function publish(counts, finished) {
    const payload = { counts, finished: !!finished };
    const send = (p) => { publishWrites++; /* one storage write */ };
    if (finished) {
      if (publishTimer) { clearTimeout(publishTimer); publishTimer = null; }
      publishQueued = null;
      publishLastAt = Date.now();
      send(payload);
      return;
    }
    const now = Date.now();
    if (now - publishLastAt >= SFIR_PUBLISH_INTERVAL_MS) {
      publishLastAt = now;
      send(payload);
      return;
    }
    publishQueued = payload;
    if (!publishTimer) {
      publishTimer = setTimeout(() => {
        publishTimer = null;
        const p = publishQueued;
        publishQueued = null;
        if (p) { publishLastAt = Date.now(); send(p); }
      }, Math.max(50, SFIR_PUBLISH_INTERVAL_MS - (now - publishLastAt)));
    }
  }

  // --- persist (mirrors sfirPersistJob throttle) ---
  function write() { persistWrites++; }
  function persist() {
    const now = Date.now();
    if (now - persistLastAt >= SFIR_PERSIST_INTERVAL_MS) { persistLastAt = now; write(); return; }
    persistPending = true;
    if (!persistTimer) {
      persistTimer = setTimeout(() => {
        persistTimer = null;
        if (persistPending) { persistPending = false; persistLastAt = Date.now(); write(); }
      }, Math.max(500, SFIR_PERSIST_INTERVAL_MS - (now - persistLastAt)));
    }
  }
  function persistOff() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    persistPending = false;
  }

  api.publish = publish;
  api.persist = persist;
  api.persistOff = persistOff;
  return api;
}

(async () => {
  const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

  // Test 1: 20 rapid publishes (every 50ms) over ~1s → at most ~2 storage writes
  {
    const e = makeEngine();
    for (let i = 0; i < 20; i++) {
      e.publish({ Succeeded: i }, false);
      await new Promise(r => setTimeout(r, 50));
    }
    await new Promise(r => setTimeout(r, 700)); // let trailing flush land
    console.log('Test1 publishes ->', e.publishWrites, 'writes (expect <= 4)');
    assert(e.publishWrites <= 4, 'publish storm not throttled: ' + e.publishWrites);
  }

  // Test 2: final publish always lands immediately
  {
    const e = makeEngine();
    e.publish({ Succeeded: 1 }, false);
    const before = e.publishWrites;
    e.publish({ Succeeded: 2 }, true); // finished
    assert(e.publishWrites === before + 1, 'finished publish did not land immediately');
    console.log('Test2 finished publish lands immediately: OK');
  }

  // Test 3: persist throttled to ~1 write per 15s window
  {
    const e = makeEngine();
    for (let i = 0; i < 10; i++) e.persist();
    await new Promise(r => setTimeout(r, 600));
    console.log('Test3 persists ->', e.persistWrites, 'writes (expect 1)');
    assert(e.persistWrites === 1, 'persist not throttled: ' + e.persistWrites);
  }

  // Test 4: persistOff cancels pending write
  {
    const e = makeEngine();
    e.persist();
    e.persist(); // queues pending
    e.persistOff();
    await new Promise(r => setTimeout(r, 600));
    assert(e.persistWrites === 1, 'persistOff failed to cancel pending write: ' + e.persistWrites);
    console.log('Test4 persistOff cancels pending: OK');
  }

  console.log('ALL THROTTLE TESTS PASSED');
})();
