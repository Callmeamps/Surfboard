/**
 * Paper Switcher - Zoom out view for tab management
 * Shows all open tabs in a grid, with scroll bar for quick switching
 */

(function() {
  'use strict';

  // ── State ────────────────────────────────────────────────
  let isOpen = false;
  let currentIndex = 0;
  let scrollVisible = false;
  let scrollTimeout = null;

  // ── DOM Elements ─────────────────────────────────────────
  const paperSwitcher = document.getElementById('paper-switcher');
  const paperGrid = document.getElementById('paper-grid');
  const paperSwitcherClose = document.getElementById('paper-switcher-close');
  const scrollSwitcher = document.getElementById('scroll-switcher');
  const scrollSwitcherItems = document.getElementById('scroll-switcher-items');

  // ── Open Paper Switcher ──────────────────────────────────
  function open() {
    if (isOpen) return;
    isOpen = true;

    // Populate grid with current tabs
    populateGrid();

    // Show with animation
    paperSwitcher.classList.add('active');

    // Focus first card
    setTimeout(() => {
      const cards = paperGrid.querySelectorAll('.paper-card');
      if (cards[currentIndex]) {
        cards[currentIndex].focus();
      }
    }, 100);
  }

  // ── Close Paper Switcher ─────────────────────────────────
  function close() {
    if (!isOpen) return;
    isOpen = false;

    paperSwitcher.classList.remove('active');

    // Return focus to main content
    document.getElementById('webview-container')?.focus();
  }

  // ── Toggle Paper Switcher ────────────────────────────────
  function toggle() {
    isOpen ? close() : open();
  }

  // ── Populate Grid ────────────────────────────────────────
  function populateGrid() {
    paperGrid.innerHTML = '';

    // Get tabs from tab list
    const tabs = document.querySelectorAll('#tab-list .tab');
    const activeTab = document.querySelector('#tab-list .tab.active');

    tabs.forEach((tab, index) => {
      const card = document.createElement('div');
      card.className = 'paper-card';
      card.tabIndex = 0;
      card.dataset.index = index;
      card.dataset.tabId = tab.dataset.tabId;

      if (tab === activeTab) {
        card.classList.add('active');
        currentIndex = index;
      }

      // Preview area (shows page thumbnail or placeholder)
      const preview = document.createElement('div');
      preview.className = 'paper-card-preview';
      preview.textContent = tab.querySelector('.tab-title')?.textContent || 'Tab';

      // Info bar
      const info = document.createElement('div');
      info.className = 'paper-card-info';

      const favicon = document.createElement('img');
      favicon.className = 'paper-card-favicon';
      favicon.src = tab.querySelector('.tab-favicon')?.src || '';
      favicon.alt = '';

      const title = document.createElement('span');
      title.className = 'paper-card-title';
      title.textContent = tab.querySelector('.tab-title')?.textContent || 'Untitled';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'paper-card-close';
      closeBtn.innerHTML = '✕';
      closeBtn.title = 'Close tab';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.dataset.tabId);
      };

      info.appendChild(favicon);
      info.appendChild(title);
      info.appendChild(closeBtn);

      card.appendChild(preview);
      card.appendChild(info);

      // Click to switch
      card.onclick = () => switchToTab(index);
      card.onkeydown = (e) => handleCardKeydown(e, index);

      paperGrid.appendChild(card);
    });

    // Update scroll switcher
    updateScrollSwitcher();
  }

  // ── Switch to Tab ────────────────────────────────────────
  function switchToTab(index) {
    const tabs = document.querySelectorAll('#tab-list .tab');
    if (tabs[index]) {
      tabs[index].click();
      close();
    }
  }

  // ── Close Tab ────────────────────────────────────────────
  function closeTab(tabId) {
    // Emit event for app.js to handle
    window.dispatchEvent(new CustomEvent('paper-switcher:close-tab', {
      detail: { tabId }
    }));

    // Re-populate after brief delay
    setTimeout(populateGrid, 50);
  }

  // ── Handle Card Keydown ──────────────────────────────────
  function handleCardKeydown(e, index) {
    const cards = paperGrid.querySelectorAll('.paper-card');
    const total = cards.length;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        currentIndex = (index + 1) % total;
        cards[currentIndex]?.focus();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        currentIndex = (index - 1 + total) % total;
        cards[currentIndex]?.focus();
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        switchToTab(index);
        break;

      case 'Escape':
        e.preventDefault();
        close();
        break;

      case 'w':
      case 'W':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          closeTab(cards[index]?.dataset.tabId);
        }
        break;
    }
  }

  // ── Scroll Switcher ──────────────────────────────────────
  function updateScrollSwitcher() {
    scrollSwitcherItems.innerHTML = '';

    const tabs = document.querySelectorAll('#tab-list .tab');
    tabs.forEach((tab, index) => {
      const item = document.createElement('div');
      item.className = 'scroll-switcher-item';
      if (index === currentIndex) {
        item.classList.add('active');
      }
      item.textContent = index + 1;
      item.onclick = () => switchToTab(index);
      scrollSwitcherItems.appendChild(item);
    });
  }

  function showScrollSwitcher() {
    scrollSwitcher.classList.add('visible');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(hideScrollSwitcher, 3000);
  }

  function hideScrollSwitcher() {
    scrollSwitcher.classList.remove('visible');
  }

  // ── Scroll Navigation ────────────────────────────────────
  function scrollNext() {
    const tabs = document.querySelectorAll('#tab-list .tab');
    currentIndex = (currentIndex + 1) % tabs.length;
    showScrollSwitcher();
    updateScrollSwitcher();

    // Update paper grid highlight if open
    if (isOpen) {
      const cards = paperGrid.querySelectorAll('.paper-card');
      cards[currentIndex]?.focus();
    }
  }

  function scrollPrev() {
    const tabs = document.querySelectorAll('#tab-list .tab');
    currentIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    showScrollSwitcher();
    updateScrollSwitcher();

    if (isOpen) {
      const cards = paperGrid.querySelectorAll('.paper-card');
      cards[currentIndex]?.focus();
    }
  }

  // ── Global Keybindings ───────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Ctrl+Tab / Ctrl+Shift+Tab - scroll through tabs
    if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      scrollNext();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      scrollPrev();
      return;
    }

    // Ctrl+M or F11 - toggle paper switcher
    if ((e.ctrlKey && e.key === 'm') || e.key === 'F11') {
      e.preventDefault();
      toggle();
      return;
    }

    // Escape - close paper switcher
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
      return;
    }

    // Number keys 1-9 with Ctrl - switch to tab by position
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      const tabs = document.querySelectorAll('#tab-list .tab');
      if (tabs[index]) {
        switchToTab(index);
      }
      return;
    }
  });

  // ── Mouse Wheel on Tab List ──────────────────────────────
  const tabList = document.getElementById('tab-list');
  if (tabList) {
    tabList.addEventListener('wheel', (e) => {
      if (e.deltaY > 0) {
        scrollNext();
      } else if (e.deltaY < 0) {
        scrollPrev();
      }
    }, { passive: true });
  }

  // ── Close Button ─────────────────────────────────────────
  paperSwitcherClose?.addEventListener('click', close);

  // ── Public API ───────────────────────────────────────────
  window.PaperSwitcher = {
    open,
    close,
    toggle,
    scrollNext,
    scrollPrev,
    get isOpen() { return isOpen; },
    get currentIndex() { return currentIndex; }
  };

})();
