/**
 * Integration tests for tab lifecycle + groups.
 * Tests tab create/close/switch, group create/assign/collapse/color/delete.
 *
 * Run with: npm run test:e2e
 * Note: These tests launch a real Electron window and may take time.
 */

const { _electron: electron } = require('playwright');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');

let electronApp;
let mainWindow;

beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['.', '--no-sandbox'],
    cwd: projectRoot,
    env: { ...process.env },
  });

  const window = await electronApp.firstWindow();
  const title = await window.title();

  if (title.includes('Extension') || title.includes('Background')) {
    await new Promise(r => setTimeout(r, 3000));
    const allWindows = electronApp.windows();
    for (const w of allWindows) {
      const t = await w.title();
      if (!t.includes('Extension') && !t.includes('Background')) {
        mainWindow = w;
        break;
      }
    }
    if (!mainWindow) mainWindow = window;
  } else {
    mainWindow = window;
  }

  await mainWindow.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 2000));
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
}, 30000);

afterAll(async () => {
  if (electronApp) await electronApp.close();
});

describe('Tab Lifecycle', () => {
  test('initial tab exists', async () => {
    const tabs = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.list();
    });
    expect(tabs.length).toBeGreaterThanOrEqual(1);
  }, 10000);

  test('create new tab', async () => {
    const before = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.list();
    });

    await mainWindow.evaluate(async () => {
      await window.electronAPI.tabs.create('https://example.com');
    });
    await new Promise(r => setTimeout(r, 500));

    const after = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.list();
    });

    expect(after.length).toBe(before.length + 1);
  }, 15000);

  test('switch tab', async () => {
    const tabs = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.list();
    });

    if (tabs.length >= 2) {
      const secondTab = tabs[1];
      await mainWindow.evaluate(async (tabId) => {
        await window.electronAPI.tabs.switch(tabId);
      }, secondTab.id);
      await new Promise(r => setTimeout(r, 300));

      const active = await mainWindow.evaluate(async () => {
        const list = await window.electronAPI.tabs.list();
        const activeTab = list.find(t => t.active);
        return activeTab?.id;
      });

      expect(active).toBe(secondTab.id);
    }
  }, 10000);

  test('close tab', async () => {
    const before = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.list();
    });

    if (before.length >= 2) {
      const tabToClose = before.find(t => !t.active) || before[before.length - 1];
      await mainWindow.evaluate(async (tabId) => {
        await window.electronAPI.tabs.close(tabId);
      }, tabToClose.id);
      await new Promise(r => setTimeout(r, 500));

      const after = await mainWindow.evaluate(async () => {
        return await window.electronAPI.tabs.list();
      });

      expect(after.length).toBe(before.length - 1);
      expect(after.find(t => t.id === tabToClose.id)).toBeUndefined();
    }
  }, 10000);

  test('active tab updates DOM', async () => {
    const activeId = await mainWindow.evaluate(async () => {
      const tabs = await window.electronAPI.tabs.list();
      const active = tabs.find(t => t.active);
      return active?.id;
    });

    const domActive = await mainWindow.evaluate((id) => {
      const tabEl = document.querySelector(`[data-tab-id="${id}"]`);
      return tabEl?.classList.contains('active') || false;
    }, activeId);

    expect(domActive).toBe(true);
  }, 10000);
});

describe('Tab Groups', () => {
  let testGroupId;

  test('create group', async () => {
    const result = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.createGroup('Test Group');
    });

    expect(result).toHaveProperty('id');
    testGroupId = result.id;

    const groups = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.groups();
    });

    expect(groups.find(g => g.id === testGroupId)).toBeDefined();
  }, 10000);

  test('group header appears in DOM', async () => {
    const headerExists = await mainWindow.evaluate((groupId) => {
      const header = document.querySelector(`[data-group-id="${groupId}"]`);
      return !!header;
    }, testGroupId);

    expect(headerExists).toBe(true);
  }, 10000);

  test('assign tab to group', async () => {
    const tabs = await mainWindow.evaluate(async () => {
      return await window.electronAPI.tabs.list();
    });

    const tabToAssign = tabs.find(t => !t.active);
    if (tabToAssign && testGroupId) {
      await mainWindow.evaluate(async (tabId, groupId) => {
        await window.electronAPI.tabs.assignToGroup(tabId, groupId);
      }, tabToAssign.id, testGroupId);
      await new Promise(r => setTimeout(r, 300));

      const groups = await mainWindow.evaluate(async () => {
        return await window.electronAPI.tabs.groups();
      });

      const group = groups.find(g => g.id === testGroupId);
      expect(group.tabs).toContain(tabToAssign.id);
    }
  }, 10000);

  test('collapse group hides tabs', async () => {
    if (testGroupId) {
      await mainWindow.evaluate(async (groupId) => {
        await window.electronAPI.tabs.toggleGroupCollapse(groupId);
      }, testGroupId);
      await new Promise(r => setTimeout(r, 300));

      const collapsed = await mainWindow.evaluate((groupId) => {
        const header = document.querySelector(`[data-group-id="${groupId}"]`);
        return header?.classList.contains('collapsed') || false;
      }, testGroupId);

      expect(collapsed).toBe(true);

      // Toggle back open
      await mainWindow.evaluate(async (groupId) => {
        await window.electronAPI.tabs.toggleGroupCollapse(groupId);
      }, testGroupId);
    }
  }, 10000);

  test('set group color', async () => {
    if (testGroupId) {
      await mainWindow.evaluate(async (groupId) => {
        await window.electronAPI.tabs.setGroupColor(groupId, '#ff0000');
      }, testGroupId);
      await new Promise(r => setTimeout(r, 300));

      const groups = await mainWindow.evaluate(async () => {
        return await window.electronAPI.tabs.groups();
      });

      const group = groups.find(g => g.id === testGroupId);
      expect(group.color).toBe('#ff0000');
    }
  }, 10000);

  test('remove tab from group', async () => {
    if (testGroupId) {
      const groups = await mainWindow.evaluate(async () => {
        return await window.electronAPI.tabs.groups();
      });

      const group = groups.find(g => g.id === testGroupId);
      if (group && group.tabs.length > 0) {
        const tabId = group.tabs[0];
        await mainWindow.evaluate(async (tabId) => {
          await window.electronAPI.tabs.removeFromGroup(tabId);
        }, tabId);
        await new Promise(r => setTimeout(r, 300));

        const afterGroups = await mainWindow.evaluate(async () => {
          return await window.electronAPI.tabs.groups();
        });

        const afterGroup = afterGroups.find(g => g.id === testGroupId);
        expect(afterGroup.tabs).not.toContain(tabId);
      }
    }
  }, 10000);

  test('delete group', async () => {
    if (testGroupId) {
      await mainWindow.evaluate(async (groupId) => {
        await window.electronAPI.tabs.deleteGroup(groupId);
      }, testGroupId);
      await new Promise(r => setTimeout(r, 300));

      const groups = await mainWindow.evaluate(async () => {
        return await window.electronAPI.tabs.groups();
      });

      expect(groups.find(g => g.id === testGroupId)).toBeUndefined();
    }
  }, 10000);
});
