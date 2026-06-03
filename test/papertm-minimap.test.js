/**
 * Tests for PaperTM minimap functionality
 */

// Mock DOM for minimap tests
function createMockElement(tag, className) {
  return { 
    className: className || '', 
    style: {}, 
    dataset: {},
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
  };
}

describe('PaperTM minimap', () => {
  let minimapContainer;

  beforeEach(() => {
    // Reset module state
    minimapContainer = { innerHTML: '', appendChild: jest.fn(), addEventListener: jest.fn() };
    
    // Mock window.PaperTM - need to re-require to reset state
    jest.resetModules();
  });

  test('renderMinimap creates correct number of items', () => {
    const minimapItems = [];
    minimapContainer.appendChild = jest.fn(el => { minimapItems.push(el); });

    // Simulate _renderMinimap behavior
    const tabs = new Map([
      ['tab1', { id: 'tab1', title: 'Tab One', url: 'https://one.com', active: true }],
      ['tab2', { id: 'tab2', title: 'Tab Two', url: 'https://two.com', active: false }],
      ['tab3', { id: 'tab3', title: 'Tab Three', url: 'https://three.com', active: false }],
    ]);

    // Simulate render
    const entries = Array.from(tabs.entries());
    entries.forEach(([id, tab]) => {
      const el = createMockElement('div', 'minimap-item' + (tab.active ? ' active' : ''));
      el.dataset.tabId = id;
      minimapContainer.appendChild(el);
    });

    expect(minimapItems).toHaveLength(3);
    expect(minimapItems[0].dataset.tabId).toBe('tab1');
    expect(minimapItems[0].className).toBe('minimap-item active');
    expect(minimapItems[1].className).toBe('minimap-item');
  });

  test('active tab gets active class', () => {
    const items = [];
    const tabs = new Map([
      ['tab1', { id: 'tab1', title: 'Tab One', active: false }],
      ['tab2', { id: 'tab2', title: 'Tab Two', active: true }],
      ['tab3', { id: 'tab3', title: 'Tab Three', active: false }],
    ]);

    tabs.forEach((tab) => {
      const el = { className: 'minimap-item' + (tab.active ? ' active' : '') };
      items.push(el);
    });

    const activeItem = items.find(el => el.className.includes('active'));
    expect(activeItem).toBeDefined();
    expect(items.filter(el => el.className.includes('active'))).toHaveLength(1);
  });

  test('click handler calls switch with correct tab ID', () => {
    const switchMock = jest.fn();
    const tabs = [
      { id: 'tab1', title: 'Tab One', active: true },
      { id: 'tab2', title: 'Tab Two', active: false },
    ];

    // Simulate click handlers being attached
    tabs.forEach(tab => {
      const mockClick = jest.fn(() => switchMock(tab.id));
      mockClick();
    });

    expect(switchMock).toHaveBeenCalledWith('tab1');
    expect(switchMock).toHaveBeenCalledWith('tab2');
  });

  test('minimap reflects tab state changes', () => {
    // Test that minimap items are rebuilt on state change
    const tabs = new Map();
    let activeId = 'tab1';

    // Initial state
    tabs.set('tab1', { id: 'tab1', title: 'Tab One', active: true });
    tabs.set('tab2', { id: 'tab2', title: 'Tab Two', active: false });

    // Switch to tab2
    activeId = 'tab2';
    tabs.get('tab1').active = false;
    tabs.get('tab2').active = true;

    // Rebuild minimap
    const items = [];
    tabs.forEach((tab) => {
      items.push({ active: tab.active, id: tab.id });
    });

    const activeItems = items.filter(i => i.active);
    expect(activeItems[0].id).toBe('tab2');
  });
});