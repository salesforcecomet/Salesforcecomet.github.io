const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');

// Conservative CSS minifier: strips comments, collapses whitespace, and drops
// trailing semicolons — without touching strings, escapes, or url(...) data
// URIs, so slds.css and the other stylesheets stay functionally identical.
function minifyCss(css) {
    let out = '';
    let i = 0;
    const n = css.length;
    while (i < n) {
        const ch = css[i];
        // Block comments
        if (ch === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end === -1 ? n : end + 2;
            continue;
        }
        // Strings (keep verbatim, honoring backslash escapes)
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < n) {
                if (css[j] === '\\') { j += 2; continue; }
                if (css[j] === ch) { j++; break; }
                j++;
            }
            out += css.slice(i, j);
            i = j;
            continue;
        }
        // Whitespace runs → single space, unless adjacent to structural chars.
        // NOTE: ':' and '[' are intentionally NOT structural — a space before
        // them is a descendant combinator (e.g. `.slds-image :not(:only-child)`
        // vs `.slds-image:not(:only-child)`), so it must be preserved.
        if (/\s/.test(ch)) {
            let j = i;
            while (j < n && /\s/.test(css[j])) j++;
            const prev = out[out.length - 1];
            if (prev && !'({},;>+~'.includes(prev)) out += ' ';
            i = j;
            continue;
        }
        // Drop semicolons immediately before a closing brace
        if (ch === ';') {
            let j = i + 1;
            while (j < n && /\s/.test(css[j])) j++;
            if (css[j] === '}') { i++; continue; }
            out += ';';
            i++;
            continue;
        }
        // Structural chars: drop any space that preceded them
        if ('{},;>+~'.includes(ch)) {
            if (out.endsWith(' ')) out = out.slice(0, -1);
            out += ch;
            i++;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

const includedDirs = ['src', 'lib', 'icons'];
const includedFiles = ['manifest.json'];

// Filter out dev documentation, source maps, unused localization files, and unused tsWorker during copy
const filterCopy = (src, dest) => {
    const basename = path.basename(src);
    if (basename === 'tsWorker.js') return false;
    if (basename === '.DS_Store' || basename === 'Thumbs.db') return false;
    if (basename.endsWith('.d.ts') || basename.endsWith('.md') || basename.endsWith('.map')) return false;
    if (basename.startsWith('editor.main.nls.') && !basename.endsWith('editor.main.nls.js')) return false;
    // Monaco worker scripts are only fetched inside a real Web Worker; the extension
    // uses a stub worker (monaco-stub-worker.js) that never fetches them, so they are
    // dead weight in the package (~1.7MB unpacked).
    if (basename === 'workerMain.js') return false;
    if (basename === 'cssWorker.js' || basename === 'htmlWorker.js' || basename === 'jsonWorker.js') return false;
    // Worker-side localization is likewise never loaded by the stub worker.
    if (basename.startsWith('simpleWorker.nls.')) return false;
    return true;
};

async function build() {
    console.log('Clearing dist directory...');
    await fs.emptyDir(distDir);

    console.log('Copying files...');
    for (const item of includedDirs) {
        const fullPath = path.join(srcDir, item);
        if (await fs.pathExists(fullPath)) {
            await fs.copy(fullPath, path.join(distDir, item), { filter: filterCopy });
        }
    }

    for (const item of includedFiles) {
        const fullPath = path.join(srcDir, item);
        if (await fs.pathExists(fullPath)) {
            await fs.copy(fullPath, path.join(distDir, item), { filter: filterCopy });
        }
    }

    console.log('Minifying JS files...');
    const processDir = async (dir) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                await processDir(filePath);
            } else if (file.endsWith('.js')) {
                // Skip already minified vendor/engine bundles to preserve encoding
                if (file.endsWith('.min.js') || file.includes('bundle') || file === 'react.js' || file === 'react-dom.js') {
                    continue;
                }
                const code = await fs.readFile(filePath, 'utf8');
                try {
                    // NOTE: mangle is intentionally OFF — variable-name renaming is
                    // treated as obfuscation by Chrome Web Store review, which can
                    // block Featured listing. Whitespace/compress minification alone
                    // keeps code readable and still shrinks the package.
                    const minified = await minify(code, {
                        mangle: false,
                        compress: true,
                        format: {
                            ascii_only: true
                        }
                    });
                    if (minified.code) {
                        await fs.writeFile(filePath, minified.code, 'utf8');
                    }
                } catch (e) {
                    console.error(`Failed to minify ${filePath}:`, e);
                }
            }
        }
    };

    await processDir(distDir);

    console.log('Minifying CSS files...');
    const minifyCssDir = async (dir) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                await minifyCssDir(filePath);
            } else if (file.endsWith('.css')) {
                const code = await fs.readFile(filePath, 'utf8');
                await fs.writeFile(filePath, minifyCss(code), 'utf8');
            }
        }
    };
    await minifyCssDir(distDir);
    console.log('Build complete.');

    console.log('Packaging optimized production ZIP archive...');
    const { execSync } = require('child_process');
    const zipPath = path.join(__dirname, 'salesforce-comet-production.zip');
    if (await fs.pathExists(zipPath)) {
        await fs.remove(zipPath);
    }
    execSync(`cd "${distDir}" && zip -r -9 "${zipPath}" .`);
    console.log('Production ZIP successfully generated at:', zipPath);
}

build().catch(console.error);
