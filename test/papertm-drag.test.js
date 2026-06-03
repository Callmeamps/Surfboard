/**
 * PaperTM drag-to-reorder tests
 *
 * Tests:
 * - Drag initiates: tab draggable, ghost shows
 * - Drop reorders DOM and state
 * - Order persists across renders
 * - Order persists across restarts (storage)
 */

// Mock deps
const mockDeps = {
 tabList: document.createElement('div'),
 wvContainer: document.createElement('div'),
 tabsIPC: {
   update: jest.fn(),
   registerWebview: jest.fn(),
   close: jest.fn(id => {
     const tabs = window.PaperTM._getState().tabs;
     const active = tabs.find(t => t.active);
     tabs.delete(id);
     return active || null;
   }),
   switch: jest.fn(id => {
     const tabs = window.PaperTM._getState().tabs;
     tabs.forEach(t => t.active = t.id === id);
     return tabs.get(id);
   }),
   create: jest.fn(url => {
     const id = `tab-${Math.random().toString(36).slice(2)}`;
     const tabs = window.PaperTM._getState().tabs;
     tabs.forEach(t => t.active = false);
     tabs.set(id, { id, url, title: 'New Tab', active: true });
     return tabs.get(id);
   }),
 },
 addrInput: {
   value: '',
 },
storage: {
   addHistoryEntry: jest.fn(),
   loadTabOrder: jest.fn(() => Promise.resolve(null)), // Start null = no persisted order
   saveTabOrder: jest.fn(() => Promise.resolve()),
 },
 ntp: {
   classList: {
     add: jest.fn(),
     remove: jest.fn(),
   },
 },
};

// Spy on PaperTM internals for testability
function spyOnPaperTMInternals() {
 spyOn(window.PaperTM, '_renderTabs').and.callThrough();
 spyOn(window.PaperTM, '_ensureWebview').and.callThrough();
}

beforeEach(() => {
 // Set up DOM
 mockDeps.tabList.innerHTML = '';
 mockDeps.wvContainer.innerHTML = '';
 document.body.appendChild(mockDeps.tabList);
 document.body.appendChild(mockDeps.wvContainer);

 // Load PaperTM
 jest.resetModules();
 require('../../src/renderer/js/papertm');
 window.PaperTM.init(mockDeps);
 spyOnPaperTMInternals();

 // Clean state
 jest.clearAllMocks();
});

afterEach(() => {
 // Cleanup DOM
 mockDeps.tabList.remove();
 mockDeps.wvContainer.remove();
});

describe('PaperTM drag-to-reorder', () => {
 let tab1, tab2, tab3;

 beforeEach(() => {
   // Create 3 tabs
   tab1 = mockDeps.tabsIPC.create('https://one.com');
   tab2 = mockDeps.tabsIPC.create('https://two.com');
   tab3 = mockDeps.tabsIPC.create('https://three.com');
 });

 test('Initial state: tabs in creation order', () => {
   const expectedOrder = [tab1.id, tab2.id, tab3.id];
   const currentOrder = Array.from(mockDeps.tabList.children).map(el => el.dataset.tabId);
   expect(currentOrder).toEqual(expectedOrder);
 });

 test('Drag initiates: tab gets `dragging` class, ghost element appears', () => {
   const tabEl = Array.from(mockDeps.tabList.children).find(el => el.dataset.tabId === tab2.id);
   const dragEvent = new DragEvent('dragstart', { bubbles: true });
   spyOn(dragEvent, 'dataTransfer').and.returnValue({
     setDragImage: jest.fn(),
     setData: jest.fn(),
   });

   tabEl.dispatchEvent(dragEvent);

   expect(tabEl.classList.contains('dragging')).toBe(true);
   expect(dragEvent.dataTransfer.setDragImage).toHaveBeenCalled();
 });

 test('Drop between other tabs: DOM reorders', () => {
   // Simulate drag tab2 → between tab1 and tab3
   const tabBefore = Array.from(mockDeps.tabList.children).find(el => el.dataset.tabId === tab1.id);
   const tabAfter = Array.from(mockDeps.tabList.children).find(el => el.dataset.tabId === tab3.id);
   const dropEvent = new DragEvent('drop', {
     bubbles: true,
     clientY: tabAfter.getBoundingClientRect().top,
   });

   // Initiate drag
   const tabEl = Array.from(mockDeps.tabList.children).find(el => el.dataset.tabId === tab2.id);
   const dragStart = new DragEvent('dragstart', { bubbles: true });
   spyOn(dragStart, 'dataTransfer').and.returnValue({
     setDragImage: jest.fn(),
     setData: jest.fn(),
     types: [],
   });
   tabEl.dispatchEvent(dragStart);

   // Drop
   tabEl.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
   mockDeps.tabList.dispatchEvent(dropEvent);

   // Verify DOM order: [tab1, tab2, tab3] → [tab1, tab3] then tab2 inserted in middle
   const currentOrder = Array.from(mockDeps.tabList.children).map(el => el.dataset.tabId);
   expect(currentOrder).toEqual([tab1.id, tab3.id, tab2.id]);
 });

 test('Drop reorders tab order state', () => {
   // State = ordered array
   expect(window.PaperTM.getTabOrder()).toEqual([tab1.id, tab2.id, tab3.id]);

   // Simulate drag reorder
   const tabEl = Array.from(mockDeps.tabList.children).find(el => el.dataset.tabId === tab2.id);
   const dragStart = new DragEvent('dragstart', { bubbles: true });
   const dropEvent = new DragEvent('drop', {
     bubbles: true,
     clientY: mockDeps.tabList.children[2].getBoundingClientRect().top,
   });

   spyOn(dragStart, 'dataTransfer').and.returnValue({
     setDragImage: jest.fn(),
     setData: jest.fn(),
     types: [],
   });
   tabEl.dispatchEvent(dragStart);
   tabEl.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
   mockDeps.tabList.dispatchEvent(dropEvent);

   // State reflects new order
   expect(window.PaperTM.getTabOrder()).toEqual([tab1.id, tab3.id, tab2.id]);
 });

 test('Order persists across renders (no strip rebuild just reorder)', () => {
   // Simulate tab update
   const updatedTab2 = mockDeps.tabsIPC.update(tab2.id, { title: 'Updated' });
   expect(window.PaperTM._renderTabs).toHaveBeenCalled();

   // Order remains
   const currentOrder = Array.from(mockDeps.tabList.children).map(el => el.dataset.tabId);
   expect(window.PaperTM.getTabOrder()).toEqual(currentOrder);
 });

test('Load: restored from storage if present', async () => {
   const persistedOrder = [tab3.id, tab1.id, tab2.id];
   mockDeps.storage.loadTabOrder.mockResolvedValue(persistedOrder);

   // Simulate restart
   require('../../src/renderer/js/papertm');
   window.PaperTM.init(mockDeps);
   await new Promise(setImmediate); // flush promise

   expect(mockDeps.storage.loadTabOrder).toHaveBeenCalled();
   const currentOrder = Array.from(mockDeps.tabList.children).map(el => el.dataset.tabId);
   expect(currentOrder).toEqual(persistedOrder);
 });

 test('Save: order persisted on reorder events', async () => {
   // Simulate drag reorder
   const tabEl = Array.from(mockDeps.tabList.children).find(el => el.dataset.tabId === tab2.id);
   const dragStart = new DragEvent('dragstart', { bubbles: true });
   const dropEvent = new DragEvent('drop', {
     bubbles: true,
     clientY: mockDeps.tabList.children[0].getBoundingClientRect().bottom + 1,
   });

   spyOn(dragStart, 'dataTransfer').and.returnValue({
     setDragImage: jest.fn(),
     setData: jest.fn(),
     types: [],
   });
   tabEl.dispatchEvent(dragStart);
   tabEl.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
   mockDeps.tabList.dispatchEvent(dropEvent);

   // Flush wait
   await new Promise(resolve => setTimeout(resolve, 0));

   expect(mockDeps.storage.saveTabOrder).toHaveBeenCalledWith([tab2.id, tab1.id, tab3.id]);
 });
});