// Minimal service worker for MV3
export {};

console.log('[Sample Rice Ext] Background script loaded');

chrome.runtime.onInstalled.addListener(() => {
 console.log('[Sample Rice Ext] Installed');
});