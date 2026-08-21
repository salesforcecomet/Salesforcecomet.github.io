// Regression tests for the nav-switch UX fixes:
//  1. The header-nav active pill is STATIC — the cross-page slide animation
//     (sfirNavSlideIn / sfirNavPrevIndex / --sfir-nav-* ) is gone.
//  2. org-limits + metadata-exporter cache their org data per-host so
//     switching back to the page renders instantly instead of re-fetching.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const tm = fs.readFileSync('src/theme-manager.js', 'utf8');
const css = fs.readFileSync('src/styles/sfir.css', 'utf8');
const ph = fs.readFileSync('src/components/PageHeader.js', 'utf8');
const ol = fs.readFileSync('src/org-limits.js', 'utf8');
const me = fs.readFileSync('src/metadata-exporter.js', 'utf8');
const distTm = fs.readFileSync('dist/src/theme-manager.js', 'utf8');
const distCss = fs.readFileSync('dist/src/styles/sfir.css', 'utf8');
const distOl = fs.readFileSync('dist/src/org-limits.js', 'utf8');
const distMe = fs.readFileSync('dist/src/metadata-exporter.js', 'utf8');

console.log('== 1. Nav pill is static (no horizontal slide) ==');
check('theme-manager: no sfirNavSlideIn keyframes ref', !tm.includes('sfirNavSlideIn'));
check('theme-manager: no sfirNavPrevIndex sessionStorage', !tm.includes('sfirNavPrevIndex'));
check('theme-manager: no --sfir-nav-from-* animation vars', !tm.includes('sfir-nav-from'));
check('theme-manager: positionNavSlider never animates', !/animation\s*=\s*'sfirNavSlideIn/.test(tm));
check('sfir.css: no sfirNavSlideIn keyframes', !css.includes('sfirNavSlideIn'));
check('sfir.css: pill has no transform transition', !css.includes('transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'));
check('PageHeader: navListRef no longer reads sessionStorage', !ph.includes('sfirNavPrevIndex'));
check('dist theme-manager: slide removed', !distTm.includes('sfirNavSlideIn') && !distTm.includes('sfirNavPrevIndex'));
check('dist sfir.css: keyframes removed', !distCss.includes('sfirNavSlideIn'));

console.log('== 2. org-limits per-org cache ==');
check('cache key is host-scoped', ol.includes("'sfir_org_limits_' + (host || 'unknown')"));
check('cache read before fetch (source)', ol.indexOf('getCachedLimits') !== -1 && ol.indexOf('/services/data/v60.0/limits') > ol.indexOf('getCachedLimits'));
check('cached path renders without fetch', /if \(cached\) \{[\s\S]*?renderLimits\(\);[\s\S]*?return;/.test(ol));
check('refresh button forces refetch', /addEventListener\('click', \(\) => loadLimits\(true\)\)/.test(ol));
check('dist: cache read renders instantly', /localStorage\.getItem\(limitsCacheKey\(\)\)/.test(distOl));
check('dist: TTL enforced', /Date\.now\(\)-cached\.ts>3e5/.test(distOl));
check('dist: refresh forces refetch', /loadLimits\(!0\)/.test(distOl));

console.log('== 3. metadata-exporter per-org cache ==');
check('cache key is host-scoped', me.includes("'sfir_org_metadata_types_' + (pageHost || 'unknown')"));
check('cached path renders types instantly', /getCachedTypes\(\)[\s\S]*?renderTypesList\(\)[\s\S]*?return;/.test(me));
check('fetch path writes cache', me.includes('cacheTypes(metadataTypes)'));
check('dist: cache read present', /localStorage\.getItem\(typesCacheKey\)/.test(distMe));

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
