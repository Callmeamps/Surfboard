/**
 * @jest-environment jsdom
 */
/**
 * PaperTM drag-to-reorder tests
 *
 * Two parts:
 * 1. Pure reorder logic (same algorithm as the drop handler)
 * 2. PaperTM public API: persistence, DOM render, tab add/remove
 */

// Polyfill requestAnimationFrame for jsdom (flush immediately)
global.requestAnimationFrame = (cb) => cb();
global.cancelAnimationFrame = () => {};

// Mock deps
const mockDeps = {
  tabList: document.createElement('div'),
  wvContainer: document.createElement('div'),
  tabsIPC: {
    update: jest.fn(),
    registerWebview: jest.fn(),
    close: jest.fn(id => {
      const state = window.PaperTM._getState();
      let active = null;
      state.tabs.forEach(t => { if (t.active) active = t; });
      state.tabs.delete(id);
      return active;
    }),
    switch: jest.fn(id => {
      const tabs = window.PaperTM._getState().tabs;
      tabs.forEach(t => { t.active = t.id === id; });
      return tabs.get(id);
    }),
    create: jest.fn(url => {
      const id = `tab-${Math.random().toString(36).slice(2)}`;
      const tabs = window.PaperTM._getState().tabs;
      tabs.forEach(t => { t.active = false; });
      tabs.set(id, { id, url, title: 'New Tab', active: true });
      return tabs.get(id);
    }),
  },
  addrInput: { value: '' },
  storage: {
    addHistoryEntry: jest.fn(),
    loadTabOrder: jest.fn(() => Promise.resolve(null)),
    saveTabOrder: jest.fn(() => Promise.resolve()),
  },
  ntp: {
    classList: { add: jest.fn(), remove: jest.fn() },
  },
};

// Helper: create tabs via onTabsUpdated so _order is populated
async function createTabs(count) {
  const tabs = [];
  for (let i = 0; i < count; i++) {
    tabs.push({
      id: `tab-${i + 1}`,
      url: `https://site${i + 1}.com`,
      title: `Site ${i + 1}`,
      active: i === 0,
    });
  }
  window.PaperTM.onTabsUpdated(tabs);
  await new Promise(resolve => setTimeout(resolve, 10));
  return tabs;
}

// Pure reorder logic — mirrors the drop handler in papertm.js
function reorderTab(order, draggedId, targetId, insertBefore) {
  const curOrder = order.slice();
  const fromIdx = curOrder.indexOf(draggedId);
  const toIdx = curOrder.indexOf(targetId);
  if (fromIdx < 0 || toIdx < 0) return curOrder;
  if (draggedId === targetId) return curOrder;
  curOrder.splice(fromIdx, 1);
  const newToIdx = insertBefore ? toIdx : toIdx + 1;
  curOrder.splice(newToIdx > fromIdx ? newToIdx - 1 : newToIdx, 0, draggedId);
  return curOrder;
}

beforeEach(() => {
  mockDeps.tabList.innerHTML = '';
  mockDeps.wvContainer.innerHTML = '';
  document.body.appendChild(mockDeps.tabList);
  document.body.appendChild(mockDeps.wvContainer);

  jest.resetModules();
  require('../src/renderer/js/papertm');
  window.PaperTM.init(mockDeps);
  jest.clearAllMocks();
});

afterEach(() => {
  mockDeps.tabList.remove();
  mockDeps.wvContainer.remove();
});

describe('PaperTM drag-to-reorder: pure logic', () => {
  const initial = ['tab-1', 'tab-2', 'tab-3'];

  test('move tab-2 to after tab-3', () => {
    expect(reorderTab(initial, 'tab-2', 'tab-3', false))
      .toEqual(['tab-1', 'tab-3', 'tab-2']);
  });

  test('move tab-3 to before tab-1', () => {
    expect(reorderTab(initial, 'tab-3', 'tab-1', true))
      .toEqual(['tab-3', 'tab-1', 'tab-2']);
  });

  test('move tab-1 to after tab-2', () => {
    expect(reorderTab(initial, 'tab-1', 'tab-2', false))
      .toEqual(['tab-2', 'tab-1', 'tab-3']);
  });

  test('move tab-1 to before tab-3', () => {
    expect(reorderTab(initial, 'tab-1', 'tab-3', true))
      .toEqual(['tab-2', 'tab-1', 'tab-3']);
  });

  test('same source and target is a no-op', () => {
    expect(reorderTab(initial, 'tab-2', 'tab-2', false))
      .toEqual(initial);
  });

  test('non-existent draggedId is a no-op', () => {
    expect(reorderTab(initial, 'tab-99', 'tab-1', true))
      .toEqual(initial);
  });

  test('non-existent targetId is a no-op', () => {
    expect(reorderTab(initial, 'tab-1', 'tab-99', true))
      .toEqual(initial);
  });

  test('move first to last', () => {
    expect(reorderTab(initial, 'tab-1', 'tab-3', false))
      .toEqual(['tab-2', 'tab-3', 'tab-1']);
  });

  test('move last to first', () => {
    expect(reorderTab(initial, 'tab-3', 'tab-1', true))
      .toEqual(['tab-3', 'tab-1', 'tab-2']);
  });
});

describe('PaperTM drag-to-reorder: state & DOM', () => {
  let tabs;

  beforeEach(async () => {
    tabs = await createTabs(3);
  });

  test('Initial state: tabs in creation order', () => {
    expect(window.PaperTM.getTabOrder()).toEqual(['tab-1', 'tab-2', 'tab-3']);
  });

  test('getTabOrder returns a copy (not the original)', () => {
    const order1 = window.PaperTM.getTabOrder();
    const order2 = window.PaperTM.getTabOrder();
    expect(order1).toEqual(order2);
    expect(order1).not.toBe(order2);
  });

  test('New tabs appended to order', async () => {
    mockDeps.storage.loadTabOrder.mockResolvedValue(null);
    const newTabs = [
      ...tabs.map(t => ({ ...t })),
      { id: 'tab-4', url: 'https://four.com', title: 'Four', active: false },
    ];
    window.PaperTM.onTabsUpdated(newTabs);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(window.PaperTM.getTabOrder()).toEqual(['tab-1', 'tab-2', 'tab-3', 'tab-4']);
  });

  test('Closed tabs removed from order', async () => {
    mockDeps.storage.loadTabOrder.mockResolvedValue(null);
    const remainingTabs = tabs.filter(t => t.id !== 'tab-2').map(t => ({ ...t }));
    window.PaperTM.onTabsUpdated(remainingTabs);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(window.PaperTM.getTabOrder()).toEqual(['tab-1', 'tab-3']);
  });
  test('DOM renders tabs in _order sequence', () => {
    const state = window.PaperTM._getState();
    state.order.length = 0;
    state.order.push('tab-3', 'tab-1', 'tab-2');
    window.PaperTM._renderTabs();

    const domOrder = Array.from(mockDeps.tabList.children).map(el => el.dataset.tabId);
    expect(domOrder).toEqual(['tab-3', 'tab-1', 'tab-2']);
  });

  test('Order persists across onTabsUpdated when storage returns null', async () => {
    const state = window.PaperTM._getState();
    state.order.length = 0;
    state.order.push('tab-3', 'tab-1', 'tab-2');

    mockDeps.storage.loadTabOrder.mockResolvedValue(null);
    window.PaperTM.onTabsUpdated(tabs.map(t => ({ ...t })));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(window.PaperTM.getTabOrder()).toEqual(['tab-3', 'tab-1', 'tab-2']);
  });

  test('Order restored from storage on init', async () => {
    const persistedOrder = ['tab-3', 'tab-1', 'tab-2'];
    mockDeps.storage.loadTabOrder.mockResolvedValue(persistedOrder);

    jest.resetModules();
    require('../src/renderer/js/papertm');
    window.PaperTM.init(mockDeps);
    window.PaperTM.onTabsUpdated(tabs);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockDeps.storage.loadTabOrder).toHaveBeenCalled();
    expect(window.PaperTM.getTabOrder()).toEqual(persistedOrder);
  });
});
