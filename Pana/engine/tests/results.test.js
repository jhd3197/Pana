import test from 'node:test';
import assert from 'node:assert/strict';

// Just enough of the DOM for rosterRow: elements with a tag, class, text and children.
class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.className = ''; this.textContent = ''; this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
}
globalThis.document = { createElement: tag => new Node(tag) };
const { rosterRow, fillRoster } = await import('../results.js');

const shape = n => [n.tagName.toLowerCase(), n.className, n.textContent, ...n.children.map(shape)];

test('a full row: rank, lead, name with detail, big score', () => {
  const chip = new Node('span');
  const row = rosterRow({ rank: 1, lead: chip, name: 'Juan', detail: 'A salvo', end: 7, score: true, me: true, className: 'score-row' });
  assert.equal(row.className, 'pk-row score-row is-me');
  assert.deepEqual(row.children.map(c => c.className), ['pk-row-n', '', 'pk-row-name', 'pk-row-end pk-row-score']);
  assert.deepEqual(shape(row.children[2]), ['span', 'pk-row-name', 'Juan', ['small', '', 'A salvo']]);
  assert.equal(row.children[3].tagName, 'B');
});

test('a bare row is just the name', () => {
  const row = rosterRow({ name: 'La Chama' });
  assert.equal(row.className, 'pk-row');
  assert.deepEqual(row.children.map(shape), [['span', 'pk-row-name', 'La Chama']]);
});

test('names stay text', () => {
  const row = rosterRow({ name: '<img src=x onerror=alert(1)>' });
  assert.equal(row.children[0].textContent, '<img src=x onerror=alert(1)>');
});

test('fillRoster matches the list: li in lists, div elsewhere', () => {
  const list = new Node('ol'), box = new Node('div');
  fillRoster(list, [{ name: 'A' }, { name: 'B' }]);
  fillRoster(box, [{ name: 'C' }]);
  assert.deepEqual(list.children.map(c => c.tagName), ['LI', 'LI']);
  assert.deepEqual(box.children.map(c => c.tagName), ['DIV']);
});
