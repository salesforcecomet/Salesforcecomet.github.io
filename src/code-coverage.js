let coverageData = [];
let currentFilter = 'all';
let currentSort = { key: 'name', dir: 'asc' };
const CIRCUMFERENCE = 2 * Math.PI * 15.5; // ~97.4

// Init
document.addEventListener('DOMContentLoaded', async () => {
  await initApi();
  loadCoverage();
  setupListeners();
});

async function initApi() {
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host') || params.get('sfHost');
  if (host && window.sfApi) {
    try {
      await window.sfApi.initFromHost(host);
      document.getElementById('cc-org-info').textContent = host;
    } catch (e) {
      document.getElementById('cc-org-info').textContent = 'Connection error';
    }
  }
}

function setupListeners() {
  document.getElementById('cc-search').addEventListener('input', () => renderTable());
  document.getElementById('cc-refresh-btn').addEventListener('click', () => loadCoverage());
  document.getElementById('cc-export-csv-btn').addEventListener('click', exportCSV);

  // Filter pills
  document.querySelectorAll('.cc-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cc-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderTable();
    });
  });

  // Sort headers
  document.querySelectorAll('.cc-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = { key, dir: key === 'name' ? 'asc' : 'desc' };
      }
      document.querySelectorAll('.cc-table thead th').forEach(h => {
        h.classList.remove('sorted');
        h.querySelector('.sort-arrow').textContent = '↕';
      });
      th.classList.add('sorted');
      th.querySelector('.sort-arrow').textContent = currentSort.dir === 'asc' ? '↑' : '↓';
      renderTable();
    });
  });
}

async function loadCoverage() {
  const tbody = document.getElementById('cc-table-body');
  tbody.innerHTML = buildSkeletonRows(8);
  
  const refreshBtn = document.getElementById('cc-refresh-btn');
  let svgIcon = null;
  if (refreshBtn) {
    refreshBtn.disabled = true;
    svgIcon = refreshBtn.querySelector('svg');
    if (svgIcon) svgIcon.classList.add('rotating');
  }

  try {
    const query = 'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE NumLinesCovered > 0 OR NumLinesUncovered > 0';
    const result = await window.sfApi.query(query, true);

    coverageData = (result.records || []).map(r => {
      const covered = r.NumLinesCovered || 0;
      const uncovered = r.NumLinesUncovered || 0;
      const total = covered + uncovered;
      const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
      return {
        name: r.ApexClassOrTrigger.Name,
        percent,
        covered,
        uncovered,
        total
      };
    });

    updateStats();
    renderTable();

  } catch (e) {
    console.error('Coverage Error', e);
    tbody.innerHTML = `<tr><td colspan="4"><div class="cc-empty-state">
      <div class="cc-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cc-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
      <div class="cc-empty-title">Error Loading Coverage</div>
      <div class="cc-empty-desc">${e.message}</div>
    </div></td></tr>`;
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      if (svgIcon) {
        setTimeout(() => {
          svgIcon.classList.remove('rotating');
        }, 600);
      }
    }
  }
}

function updateStats() {
  const totalClasses = coverageData.length;
  const totalCovered = coverageData.reduce((a, c) => a + c.covered, 0);
  const totalLines = coverageData.reduce((a, c) => a + c.total, 0);
  const avgPercent = totalLines > 0 ? Math.round((totalCovered / totalLines) * 100) : 0;
  const passing = coverageData.filter(c => c.percent >= 75).length;
  const failing = totalClasses - passing;

  // Avg donut
  document.getElementById('cc-avg-value').textContent = avgPercent + '%';
  setDonut('cc-donut-avg-fill', avgPercent);
  const avgFill = document.getElementById('cc-donut-avg-fill');
  avgFill.setAttribute('stroke', avgPercent >= 75 ? '#10b981' : avgPercent >= 50 ? '#f59e0b' : '#ef4444');
  const badge = document.getElementById('cc-avg-badge');
  badge.style.display = '';
  badge.textContent = avgPercent >= 75 ? '✓ Good' : avgPercent >= 50 ? '⚠ Warning' : '✗ Low';
  badge.className = 'cc-stat-badge ' + (avgPercent >= 75 ? 'good' : avgPercent >= 50 ? 'warning' : 'danger');

  // Pass donut
  const passPercent = totalClasses > 0 ? Math.round((passing / totalClasses) * 100) : 0;
  document.getElementById('cc-pass-value').textContent = passing;
  setDonut('cc-donut-pass-fill', passPercent);

  // Fail donut
  const failPercent = totalClasses > 0 ? Math.round((failing / totalClasses) * 100) : 0;
  document.getElementById('cc-fail-value').textContent = failing;
  setDonut('cc-donut-fail-fill', failPercent);

  // Total
  document.getElementById('cc-total-value').textContent = totalClasses;
}

function setDonut(id, percent) {
  const fill = document.getElementById(id);
  const value = (percent / 100) * CIRCUMFERENCE;
  fill.setAttribute('stroke-dasharray', `${value} ${CIRCUMFERENCE}`);
}

function getFilteredSorted() {
  const search = document.getElementById('cc-search').value.toLowerCase();
  let data = coverageData.filter(c => c.name.toLowerCase().includes(search));

  if (currentFilter === 'passing') data = data.filter(c => c.percent >= 75);
  else if (currentFilter === 'warning') data = data.filter(c => c.percent >= 50 && c.percent < 75);
  else if (currentFilter === 'failing') data = data.filter(c => c.percent < 50);

  data.sort((a, b) => {
    let cmp = 0;
    if (currentSort.key === 'name') cmp = a.name.localeCompare(b.name);
    else cmp = a[currentSort.key] - b[currentSort.key];
    return currentSort.dir === 'asc' ? cmp : -cmp;
  });

  return data;
}

function renderTable() {
  const data = getFilteredSorted();
  const tbody = document.getElementById('cc-table-body');
  document.getElementById('cc-showing-count').textContent = `Showing ${data.length} of ${coverageData.length} classes`;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="cc-empty-state">
      <div class="cc-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cc-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
      <div class="cc-empty-title">No Classes Found</div>
      <div class="cc-empty-desc">No Apex classes match your current search or filter criteria.</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const level = item.percent >= 75 ? 'high' : item.percent >= 50 ? 'medium' : 'low';
    return `<tr>
      <td><span class="cc-class-name">${item.name}</span></td>
      <td>
        <div class="cc-progress-cell">
          <div class="cc-progress-track">
            <div class="cc-progress-fill ${level}" style="width: ${item.percent}%"></div>
          </div>
          <span class="cc-percent-text ${level}">${item.percent}%</span>
        </div>
      </td>
      <td><span class="cc-line-count">${item.covered.toLocaleString()}</span></td>
      <td><span class="cc-uncovered-count ${item.uncovered > 0 ? 'has-uncovered' : 'none'}">${item.uncovered.toLocaleString()}</span></td>
    </tr>`;
  }).join('');
}

function buildSkeletonRows(count) {
  return Array.from({ length: count }, () =>
    `<tr class="cc-skeleton-row"><td colspan="4"><div class="cc-skeleton-bar" style="width: ${60 + Math.random() * 30}%; height: 14px;"></div></td></tr>`
  ).join('');
}

function exportCSV() {
  const data = getFilteredSorted();
  if (data.length === 0) return;
  const rows = [['Apex Class', 'Coverage %', 'Covered Lines', 'Uncovered Lines']];
  data.forEach(d => rows.push([d.name, d.percent, d.covered, d.uncovered]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'code-coverage.csv';
  a.click();
  URL.revokeObjectURL(url);
  if (window.glassToast) window.glassToast.success('CSV exported successfully');
}
