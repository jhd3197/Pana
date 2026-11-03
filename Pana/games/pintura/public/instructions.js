// Pepazo's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Pinta a tus rivales entre las barricadas: gana quien llegue a la meta de la ronda o vaya adelante al terminar el tiempo.'),
  howTo: [
    loc('Una pintada suma un punto. Gana quien llegue a diez o lidere al terminar el tiempo. Con vidas limitadas también gana el último pana o equipo en pie.'),
    loc('En bandera gana el equipo que llegue primero a las capturas de la sala; en dominación, el que sume los puntos de la meta.'),
    loc('En Hardcore un pepazo te saca, pero vuelves rápido y sin límite de vidas.'),
    loc('Si te pintan en primera persona, miras a los panas que siguen en pie hasta que vuelves a la cancha.'),
  ],
  sections: [{ title: loc('Moverte'), rows: [
    { action: loc('Caminar hacia donde miras'), keyboard: 'W A S D / ' + loc('Flechas'), gamepad: 'Stick izq.', touch: loc('Cruceta') },
    { action: loc('Mirar y apuntar (haz clic en la cancha para capturar el ratón)'), keyboard: loc('Ratón'), gamepad: 'Stick der.', touch: loc('Arrastra el dedo') },
    { action: loc('Girar sin ratón'), keyboard: 'Q / E' },
    { action: loc('Saltar'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Saltar') },
    { action: loc('Correr (no puedes disparar corriendo)'), keyboard: 'Shift', gamepad: 'LB / L3' },
  ] }, { title: loc('Pintar'), rows: [
    { action: loc('Disparar pintura'), keyboard: loc('Clic / Enter'), gamepad: 'RT', touch: loc('Botón Pinta') },
    { action: loc('Apuntar (La Lejana mira por la mira telescópica)'), keyboard: loc('Clic derecho / F'), gamepad: 'LT', touch: loc('Botón Mira') },
    { action: loc('Con La Chancleta: lanzarla en arco (vuelve sola a tu mano)'), keyboard: loc('Clic derecho / F / V'), gamepad: 'R3' },
    { action: loc('Recargar'), keyboard: 'R', gamepad: 'X', touch: loc('Botón Carga') },
    { action: loc('Mantén para cargar la granada y suelta para lanzarla'), keyboard: 'G', gamepad: 'RB', touch: loc('Botón Granada') },
    { action: loc('Arma anterior o siguiente (las de pescozón van al final)'), keyboard: 'Z / X', gamepad: 'Y', touch: loc('Flechas de marcadora') },
    { action: loc('Chispa / Trueno / Gemelas / Cohetón / Lejana / Bazuca'), keyboard: '1 – 6' },
  ] }, { title: loc('Polígono de tiro (Probar, en la armería)'), rows: [
    { action: loc('Reponer los blancos'), keyboard: 'T', gamepad: 'Y', touch: loc('Botón de reponer') },
    { action: loc('Volver a la armería'), keyboard: 'Esc', gamepad: 'B / Start', touch: loc('Botón Volver') },
  ] }, { title: loc('Fuera de la ronda'), rows: [
    { action: loc('Cambiar de pana'), keyboard: 'Q / E', gamepad: 'LB / RB', touch: loc('Flechas del nombre') },
    { action: loc('Ver la cancha desde arriba'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Cámara') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Ver la tabla y el mapa completo'), keyboard: 'Tab', gamepad: 'View' },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Soltar el ratón y abrir el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Las barricadas frenan las bolas. Tienes doce por carga; recargas con R o automáticamente al vaciarla.'),
    loc('Vuelves a la cancha 2,5 segundos después de una pintada. Al reaparecer tienes 1,5 segundos de protección; disparar la cancela.'),
    loc('En teléfono camina con las flechas y arrastra el dedo por la pantalla para mirar. Mantén Pinta: la mira se pega al rival visible que tengas delante.'),
    loc('El mapa de la esquina muestra lo que tienes alrededor (unos 30 m): tu equipo y solo los rivales que tienes a la vista. Mantén Tab para ver la cancha completa.'),
    loc('Mantén G para cargar la granada: los puntos marcan su arco y el anillo, hasta dónde pinta. Mira hacia arriba para lanzarla más alto. La mecha corre al soltarla.'),
    loc('La Lejana pinta dos pepazos por tiro, pero sin la mira se desvía. El cohete de La Bazuca saca de una si pega directo: apunta adelante del rival.'),
    loc('En la armería cada arma tiene su puesto para la mira, el cañón, la tolva y la culata. La tolva chica recarga rápido; la grande lleva más bolas.'),
    loc('Probar, en la armería, abre el polígono de tiro con tu kit: blancos de 10 a 100 m, y cada impacto dice su distancia y sus pepazos.'),
    loc('Si estás solo, tres bots entran contigo; con amigos la cancha es de ustedes. En Más ajustes eliges cuántos bots juegan. Puedes invitar hasta ocho panas.'),
  ],
};
