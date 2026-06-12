require('./setup-feature-platform');

/**
 * DataPipeline tests
 * Covers: init/enable/disable, scraping, mapping, ETL, trust gating.
 */
describe('DataPipeline', () => {
  let root;
  beforeEach(() => {
    window.DataPipeline?.reset?.();
    window.TrustManager?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'data', action: 'scrape' }]);
    root = document.createElement('div');
    root.id = 'app';
    root.innerHTML = `
      <table id="prices">
        <thead><tr><th>Name</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td>Alpha</td><td>$10</td></tr>
          <tr><td>Beta</td><td>$20</td></tr>
        </tbody>
      </table>
      <a href="https://example.com">Link</a>
      <a href="https://example.org">Other</a>
      <article><h2>Title</h2><p>Context</p></article>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(root);
    window.DataPipeline.init({ root });
  });

  afterEach(() => {
    window.DataPipeline?.reset?.();
  });

  // ── Init & Enable / Disable ─────────────────────────────
  test('enable() with no root returns false', () => {
    const bad = window.DataPipeline?.init?.({ root: null });
    expect(window.DataPipeline.enable()).toBe(false);
  });

  test('enable() with root returns true', () => {
    expect(window.DataPipeline.enable()).toBe(true);
    expect(root.hasAttribute('data-data-active')).toBe(true);
  });

  test('disable() clears attribute and state', () => {
    window.DataPipeline.enable();
    window.DataPipeline.disable();
    expect(root.hasAttribute('data-data-active')).toBe(false);
  });

  // ── Scrape ───────────────────────────────────────────────
  test('extractTable returns matrix', () => {
    window.DataPipeline.enable();
    const tables = window.DataPipeline.extractTable();
    expect(tables.length).toBe(1);
    expect(tables[0].data.headers).toEqual(['Name', 'Price']);
    expect(tables[0].data.rows).toEqual([
      ['Alpha', '$10'],
      ['Beta', '$20'],
    ]);
  });

  test('extractLinks returns text + href', () => {
    window.DataPipeline.enable();
    const links = window.DataPipeline.extractLinks();
    expect(links.length).toBeGreaterThanOrEqual(1);
    const link = links.find((l) => l.href === 'https://example.com');
    expect(link?.text).toBe('Link');
  });

  test('extractTextBlocks collects blocks', () => {
    window.DataPipeline.enable();
    const blocks = window.DataPipeline.extractTextBlocks();
    const texts = blocks.map((b) => b.text);
    expect(texts).toContain('Title');
    expect(texts).toContain('Context');
  });

  // ── Map ──────────────────────────────────────────────────
  test('mapFields maps cell indexes', () => {
    window.DataPipeline.enable();
    const rows = [['Alpha', '$10'], ['Beta', '$20']];
    const mapped = window.DataPipeline.mapFields(rows, {
      name: 0,
      price: 1,
    });
    expect(mapped).toEqual([
      { name: 'Alpha', price: '$10' },
      { name: 'Beta', price: '$20' },
    ]);
  });

  test('mapFields returns [] for null input', () => {
    expect(window.DataPipeline.mapFields(null, { name: 0 })).toEqual([]);
  });

  // ── Transform ─────────────────────────────────────────────
  test('transform applies function to single item', () => {
    window.DataPipeline.enable();
    const out = window.DataPipeline.transform(['Alpha', '$10'], (r) => ({
      name: r[0],
      cost: Number(r[1].replace(/\D/g, '')),
    }));
    expect(out).toEqual({ name: 'Alpha', cost: 10 });
  });

  test('transform returns item on non-function', () => {
    window.DataPipeline.enable();
    const item = ['Alpha', '$10'];
    expect(window.DataPipeline.transform(item, 'not a fn')).toBe(item);
  });

  test('transformRows applies to all rows', () => {
    window.DataPipeline.enable();
    const rows = [['Alpha', '$10'], ['Beta', '$20']];
    const out = window.DataPipeline.transformRows(rows, (r) => ({
      name: r[0],
      cost: Number(r[1].replace(/\D/g, '')),
    }));
    expect(out).toEqual([
      { name: 'Alpha', cost: 10 },
      { name: 'Beta', cost: 20 },
    ]);
  });

  // ── Events ───────────────────────────────────────────────
  test('onChange fires for extractTable', () => {
    window.DataPipeline.enable();
    const events = [];
    window.DataPipeline.onChange((type, detail) => events.push({ type, detail }));
    window.DataPipeline.extractTable();
    expect(events.some((e) => e.type === 'extracted-tables')).toBe(true);
  });
});
