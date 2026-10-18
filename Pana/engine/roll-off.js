// Who goes first: every pana throws one die and the highest starts. Pure, no
// Three.js and no DOM, so rules.js files and Node tests can share it.
//
//   rollOffGroups([{ id: 0, value: 4 }, { id: 1, value: 6 }, { id: 2, value: 4 }])
//     → [[1], [0, 2]]   (1 starts; 0 and 2 tied and throw again for second place)

// Contenders grouped by roll, highest first. A group with more than one id is a
// tie those panas break by throwing again; ids keep their order inside a group.
export function rollOffGroups(rolls) {
  const values = [...new Set(rolls.map(r => r.value))].sort((a, b) => b - a);
  return values.map(value => rolls.filter(r => r.value === value).map(r => r.id));
}

// "Rojo y Verde" style lists for the toasts.
export function namesList(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}
