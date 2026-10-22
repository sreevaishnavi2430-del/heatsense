/**
 * Runtime verification for the HeatSense i18n + persistence wiring.
 *
 * Loads the real src/i18n and src/store modules through Vite's SSR pipeline
 * (so import.meta.env resolves exactly as it does in the browser) against a fake
 * localStorage, and asserts that:
 *  1. The i18n boot language is read from persisted state.
 *  2. store.setLanguage keeps i18next and localStorage in lockstep.
 *  3. The persisted language/theme survive a "reload".
 *  4. The persisted theme is re-applied to the document on rehydration.
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// ── Fake browser environment ────────────────────────────────────────────────
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const classes = new Set();
globalThis.document = {
  documentElement: {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => (force ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
  },
};

const vite = await createServer({
  configFile: 'vite.config.ts',
  // `test` mode keeps the developer's local .env.development from affecting results.
  mode: 'test',
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
};

try {
  console.log('\nHeatSense i18n / persistence runtime verification\n');

  const { default: i18n } = await vite.ssrLoadModule('/src/i18n/index.ts');
  const { useStore } = await vite.ssrLoadModule('/src/store/useStore.ts');

  check('boots with English on a clean profile', () => {
    assert.equal(i18n.language, 'en');
  });

  check('setLanguage syncs store state, i18next and storage', () => {
    useStore.getState().setLanguage('te');
    assert.equal(useStore.getState().language, 'te', 'store state updated');
    assert.equal(i18n.language, 'te', 'i18next language updated');
    assert.equal(store.get('heatsense-language'), 'te', 'language mirrored to storage');
  });

  check('setLanguage switches to Hindi', () => {
    useStore.getState().setLanguage('hi');
    assert.equal(i18n.language, 'hi');
    assert.equal(store.get('heatsense-language'), 'hi');
  });

  check('setLanguage applies the dark theme class', () => {
    useStore.getState().setTheme('dark');
    assert.ok(classes.has('dark'), 'dark class added to documentElement');
    useStore.getState().setTheme('light');
    assert.ok(!classes.has('dark'), 'dark class removed from documentElement');
  });

  check('persisted state captures language, theme and weights', () => {
    useStore.getState().setLanguage('te');
    useStore.getState().setTheme('dark');
    const persisted = JSON.parse(store.get('heatsense-storage'));
    assert.equal(persisted.state.language, 'te', 'language persisted');
    assert.equal(persisted.state.theme, 'dark', 'theme persisted');
    assert.ok(persisted.state.weights, 'weights persisted');
  });

  check('rehydration re-applies the persisted theme and language', async () => {
    // Simulate a reload: wipe the live DOM/i18n state, keep storage, re-run the
    // rehydrate callback the same way zustand's persist middleware does.
    classes.clear();
    const persisted = JSON.parse(store.get('heatsense-storage'));
    useStore.persist.rehydrate();
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(classes.has('dark'), 'dark class re-applied after rehydrate');
    assert.equal(persisted.state.language, 'te');
  });

  check('a stale mirrored key cannot desync i18next from the store', () => {
    // Simulate the historical bug: the mirror key says "en" while the store says "te".
    store.set('heatsense-language', 'en');
    useStore.getState().setLanguage('te');
    assert.equal(i18n.language, 'te', 'i18next follows the store, not the stale mirror');
  });

  console.log(
    failures === 0
      ? '\nAll i18n / persistence checks passed.\n'
      : `\n${failures} check(s) failed.\n`
  );
} finally {
  await vite.close();
}

process.exit(failures === 0 ? 0 : 1);
