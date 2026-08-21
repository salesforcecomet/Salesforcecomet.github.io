/**
 * Salesforce Comet — Vault Crypto
 *
 * AES-256-GCM encryption for the account vault (saved Salesforce passwords).
 *
 * Design:
 *  - A master passphrase is derived into a 256-bit AES-GCM key with PBKDF2
 *    (SHA-256, 310,000 iterations) and a random per-vault salt.
 *  - Passwords are stored encrypted (iv + ciphertext) in chrome.storage.local.
 *  - The derived key is cached in chrome.storage.session, which is in-memory
 *    only and cleared when the browser session ends — so the key never touches
 *    disk and the user unlocks once per browser session.
 *  - A verifier blob (AES-GCM of a known constant) validates the passphrase.
 *
 * The passphrase itself is never stored; if the user forgets it, encrypted
 * passwords cannot be recovered and must be re-entered.
 */
(function () {
  'use strict';

  const VERIFIER_PLAINTEXT = 'salesforce-comet-vault-v1';
  const KDF_ITERATIONS = 310000;

  function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function deriveKey(passphrase, saltBuf, iterations) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations: iterations || KDF_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      true, // extractable so the key bytes can be cached in session storage
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );
    return { iv: bufToBase64(iv), data: bufToBase64(data) };
  }

  async function decrypt(key, payload) {
    if (!payload || !payload.iv || !payload.data) return '';
    const iv = base64ToBuf(payload.iv);
    const data = base64ToBuf(payload.data);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  }

  // Create a fresh vault: returns { meta, key }.
  async function create(passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
    const verifier = await encrypt(key, VERIFIER_PLAINTEXT);
    return {
      meta: { version: 1, iterations: KDF_ITERATIONS, salt: bufToBase64(salt), verifier },
      key
    };
  }

  // Validate a passphrase against existing vault metadata. Returns the key, or
  // null when the passphrase is wrong.
  async function unlock(passphrase, meta) {
    if (!meta || !meta.salt || !meta.verifier) return null;
    try {
      const salt = base64ToBuf(meta.salt);
      const key = await deriveKey(passphrase, salt, meta.iterations || KDF_ITERATIONS);
      const check = await decrypt(key, meta.verifier);
      return check === VERIFIER_PLAINTEXT ? key : null;
    } catch (e) {
      return null;
    }
  }

  async function exportKeyBytes(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    return bufToBase64(raw);
  }

  async function importKeyBytes(b64) {
    const raw = base64ToBuf(b64);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  const api = {
    KDF_ITERATIONS,
    encrypt,
    decrypt,
    create,
    unlock,
    exportKeyBytes,
    importKeyBytes
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.VaultCrypto = api;
  }
})();
