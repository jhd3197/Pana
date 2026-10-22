// Let the browser present the new status before doing the next construction
// step. Also works when requestAnimationFrame is throttled in a hidden tab.
export function paintNext() {
  return new Promise(resolve => {
    const fallback = setTimeout(resolve, 100);
    requestAnimationFrame(() => setTimeout(() => { clearTimeout(fallback); resolve(); }, 0));
  });
}

// Loading-screen tips: real rules only.
import { ITEM_ICONS } from './item-art.js';
import { ICONS as SVG } from '/engine/icons.js';
export const TIPS = [
  [SVG.mango, 'Lleva un mango equipado: bloquea el mango que te lancen.'],
  [SVG.coin, 'Cada moneda te da un poquito más de velocidad, hasta 10.'],
  [SVG.crate, 'Rompe cajas de madera para conseguir objetos. Guardas hasta 2.'],
  [SVG.juice, 'El jugo de mango te da un turbo: tómatelo en una recta.'],
  [SVG.back, 'Lanza hacia atrás con X para frenar al que te persigue.'],
  [ITEM_ICONS.drift, 'Mantén Shift y gira: la ayuda suaviza el derrape. Suelta Shift para salir con turbo.'],
  [ITEM_ICONS.drift, 'En una rampa, pulsa Shift en el aire para hacer un truco y caer con turbo.'],
  [ITEM_ICONS.cohete, 'El cohete persigue al carro que va justo delante de ti.'],
  [ITEM_ICONS.chancleta, 'La chancleta vuela por encima de la pista y cae sobre el líder.'],
  [ITEM_ICONS.totuma, 'La totuma protectora aguanta un golpe de lo que sea.'],
  [ITEM_ICONS.aguacero, 'El aguacero avanza hacia el líder cada 1,8 segundos. Cuanto más adelante, más dura.'],
  [ITEM_ICONS.trampa, 'Ojo con las cajas con banda roja: son trampas y explotan.'],
  [SVG.coin, 'Con 10 monedas tu próximo objeto sale potenciado.'],
  [SVG.back, '¿Atascado o te caíste? Pulsa R y el zamuro te devuelve a la pista.'],
  [ITEM_ICONS.aguacero, 'En Pana Selva y Pana Páramo llueve: con cauchos de lluvia no resbalas.'],
  [SVG.crate, 'Busca los puentes de tablas: son atajos, pero sin turbo frenan y sin baranda te puedes caer.'],
  [SVG.coin, 'Pégate detrás de otro carro en la recta: el rebufo te lanza hacia adelante.'],
  [SVG.coin, 'Si te pegan pierdes monedas. Cuídalas: cada una es velocidad.'],
];
