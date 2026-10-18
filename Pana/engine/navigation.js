// Short chevrons for navigation; keyboard hints keep their actual key labels.
import { icon } from './icons.js';

function decorate(control) {
  if (!control.matches('a, button') || control.closest('[data-pana-hint], .pk-touch, .pk-dpad')) return;
  for (const text of [...control.childNodes]) {
    if (text.nodeType !== Node.TEXT_NODE || !/[←→‹›]/.test(text.textContent)) continue;
    text.replaceWith(...text.textContent.split(/([←→‹›])/).map(part => {
      if (!/^[←→‹›]$/.test(part)) return document.createTextNode(part);
      const arrow = icon(/[←‹]/.test(part) ? 'chevronLeft' : 'chevronRight');
      arrow.classList.add('pk-nav-chevron');
      return arrow;
    }));
  }
}

function scan(root) {
  if (root.nodeType === Node.TEXT_NODE) { if (root.parentElement) decorate(root.parentElement); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  decorate(root);
  root.querySelectorAll('a, button').forEach(decorate);
}

if (document.body) scan(document.body);
else document.addEventListener('DOMContentLoaded', () => scan(document.body), { once: true });
new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') scan(record.target);
    else record.addedNodes.forEach(scan);
  }
}).observe(document.documentElement, { childList: true, characterData: true, subtree: true });
