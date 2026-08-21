// Builds a faithful History/Saved drawer harness with the REAL sfir.css
// inlined (the htmlPath preview server does not serve ../src resources).
const fs = require('fs');
const sfir = fs.readFileSync('src/styles/sfir.css', 'utf8');

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>History / Saved Drawer — Toggle Stability</title>
<style>
${sfir}
  /* Harness-only scaffolding (namespaced, cannot collide with sfir rules) */
  html, body { margin: 0; padding: 0; background: #0f1115; }
  .fake-table {
    width: 700px; margin: 0 auto; padding-top: 24px;
    font: 12px/2.2 'Inter', sans-serif; color: #c9d1dc;
  }
  .fake-table .row {
    display: grid; grid-template-columns: 40px 90px 90px 1fr;
    border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 10px;
  }
  .fake-table .row.head { color: #7c8494; font-weight: 600; }
  .fake-table .row .c { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .measure {
    position: fixed; bottom: 8px; left: 8px; z-index: 9999999;
    background: rgba(0,0,0,0.75); color: #7ee787; font: 11px/1.5 ui-monospace, monospace;
    padding: 8px 10px; border-radius: 8px; white-space: pre;
  }
</style>
</head>
<body>
  <div class="fake-table" id="table">
    <div class="row head"><span class="c">#</span><span class="c">OBJECT</span><span class="c">OWNERID</span><span class="c">BILLINGADDRESS</span></div>
    <div class="row"><span class="c">1</span><span class="c">Account</span><span class="c">0055g00000BLUTqAAP</span><span class="c">312 Constitution Place Austin, TX 78767 USA</span></div>
    <div class="row"><span class="c">2</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">525 S. Lexington Ave, Burlington, NC, 27215, USA</span></div>
    <div class="row"><span class="c">3</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">2 Place Jussieu, Paris, 75251, France</span></div>
    <div class="row"><span class="c">4</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">4001 Hook Drive, Lawrence, KS, 66046, USA</span></div>
    <div class="row"><span class="c">5</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">888 N Euclid Hallis Center, Room 501 Tucson, AZ</span></div>
    <div class="row"><span class="c">6</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">Kings Park, 17th Avenue, Team Valley Trading Estate</span></div>
    <div class="row"><span class="c">7</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">9 Tagore Lane Singapore, Singapore 787472</span></div>
    <div class="row"><span class="c">8</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">345 Shoreline Park Mountain View, CA 94043 USA</span></div>
    <div class="row"><span class="c">9</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">The Landmark @ One Market, San Francisco, CA</span></div>
    <div class="row"><span class="c">10</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">NY</span></div>
    <div class="row"><span class="c">11</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">NY</span></div>
    <div class="row"><span class="c">12</span><span class="c">Account</span><span class="c">0055g00000AoAsMAAV</span><span class="c">Muzaffarnagar, Please select a State</span></div>
  </div>
  <div class="measure" id="measure">waiting…</div>

  <div class="sfir-history-dropdown-layer" id="layer">
    <div class="sfir-history-drawer" id="drawer" style="top: 200px; left: 120px; width: 560px; max-width: calc(100vw - 24px);">
      <div class="sfir-history-drawer-header">
        <div class="sfir-history-drawer-segmented-control">
          <span class="sfir-history-seg-indicator left" id="ind"></span>
          <button type="button" class="sfir-segmented-tab active" id="tab-history">History (13)</button>
          <button type="button" class="sfir-segmented-tab" id="tab-saved">★ Saved (1)</button>
        </div>
        <div class="sfir-history-drawer-search-wrapper">
          <span class="sfir-history-drawer-search-icon">🔍</span>
          <input type="text" class="sfir-history-drawer-search" id="search" placeholder="Search history queries...">
        </div>
        <div class="sfir-history-drawer-actions">
          <button type="button" class="sfir-history-drawer-clear-btn" id="clear-btn">🗑 Clear History</button>
          <button type="button" class="sfir-history-drawer-close-btn" id="close-btn">✕</button>
        </div>
      </div>
      <div class="sfir-history-drawer-body" id="body"></div>
    </div>
  </div>

<script>
  const HISTORY_QUERIES = [
    "SELECT OwnerId, BillingAddress FROM Account",
    "SELECT OwnerId, AccountNumber, BillingAddress FROM Account",
    "SELECT OwnerId, AccountNumber, AccountSource, BillingAddress FROM Account",
    "SELECT OwnerId, AccountNumber, AccountSource, Active__c, AnnualRevenue FROM Account",
    "SELECT OwnerId, AccountNumber, AccountSource, Active__c, AnnualRevenue, BillingCity FROM Account",
    "SELECT OwnerId, AccountNumber, AccountSource, Active__c, BillingCity, BillingCountry FROM Account",
    "SELECT AccountNumber, AccountSource, Active__c, AnnualRevenue, BillingCity, BillingCountry FROM Account",
    "SELECT FIELDS(ALL) FROM Account LIMIT 200",
    "SELECT Industry, BillingLatitude, Accountowermanager__c FROM Account",
    "SELECT Industry, BillingLatitude, Accountowermanager__c, BillingLongitude FROM Account",
    "SELECT Id FROM Account",
    "SELECT Id, Name, CreatedDate, LastModifiedDate FROM Opportunity",
    "SELECT Id, Name, Type FROM Lead"
  ];
  const SAVED = [{ name: "Account Query", query: "SELECT OwnerId, BillingAddress FROM Account" }];

  let isSaved = false;
  const body = document.getElementById('body');

  function renderList(items, saved) {
    body.innerHTML = '';
    if (!items.length) {
      body.innerHTML = '<div class="sfir-history-empty-state"><p class="sfir-history-empty-title">' +
        (saved ? 'No saved queries yet' : 'No query history yet') + '</p></div>';
      return;
    }
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'sfir-history-item' + (saved ? ' sfir-saved-item' : '');
      row.style.animationDelay = (idx * 45) + 'ms';
      const content = document.createElement('div');
      content.className = 'sfir-saved-item-content';
      const query = document.createElement('div');
      query.className = 'sfir-history-item-query';
      query.textContent = item.query || item;
      query.title = item.query || item;
      content.appendChild(query);
      const actions = document.createElement('div');
      actions.className = 'sfir-history-item-actions';
      const load = document.createElement('button');
      load.type = 'button'; load.className = 'sfir-history-item-load-btn'; load.textContent = 'Load';
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'sfir-history-item-delete-btn'; del.textContent = '🗑';
      actions.appendChild(load); actions.appendChild(del);
      row.appendChild(content); row.appendChild(actions);
      body.appendChild(row);
    });
  }

  function applyState() {
    const historyBtn = document.getElementById('tab-history');
    const savedBtn = document.getElementById('tab-saved');
    const ind = document.getElementById('ind');
    const search = document.getElementById('search');
    const clearBtn = document.getElementById('clear-btn');
    historyBtn.className = 'sfir-segmented-tab' + (isSaved ? '' : ' active');
    savedBtn.className = 'sfir-segmented-tab' + (isSaved ? ' active' : '');
    ind.className = 'sfir-history-seg-indicator' + (isSaved ? ' right' : ' left');
    search.placeholder = isSaved ? 'Search saved queries...' : 'Search history queries...';
    clearBtn.style.display = isSaved ? 'none' : '';
    renderList(isSaved ? SAVED : HISTORY_QUERIES, isSaved);
    measure();
  }

  function measure() {
    const d = document.getElementById('drawer').getBoundingClientRect();
    const anims = Array.from(document.querySelectorAll('.sfir-history-item'))
      .map(el => getComputedStyle(el).animationName || 'none');
    const el = document.getElementById('measure');
    el.textContent =
      'drawer: top=' + Math.round(d.top) + ' left=' + Math.round(d.left) +
      ' w=' + Math.round(d.width) + ' h=' + Math.round(d.height) + '\\n' +
      'items: ' + anims.length + '  item anim: ' + (anims[0] || 'none') +
      (anims.length > 1 ? ' …' : '') + '\\n' +
      'tab: ' + (isSaved ? 'SAVED' : 'HISTORY');
  }

  document.getElementById('tab-history').addEventListener('click', () => { isSaved = false; applyState(); });
  document.getElementById('tab-saved').addEventListener('click', () => { isSaved = true; applyState(); });
  applyState();
</script>
</body>
</html>
`;

fs.writeFileSync('scratch-harness/history-drawer-toggle-preview.html', harness);
console.log('written', harness.length, 'bytes');
