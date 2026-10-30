# Changelog

What changed in Pana, for the people who play it. Newest first. Every change
that players, hosts or contributors will notice adds a line under
`## Unreleased` in the same commit (see `AGENTS.md`). Each merge to `main` releases:
the release workflow stamps Unreleased with the version and date, and that section
becomes the GitHub release's notes.

## Unreleased

- **Pepazo espera a todos antes de arrancar la ronda.**
  Hay pantalla de carga y, cuando todos cargaron, una cuenta 3-2-1: hasta el
  ¡YA! nadie se mueve, dispara ni recibe disparos. Ahora apareces lejos de
  tus rivales, y El Puerto es el mapa por defecto.
- **En Trifulca los peleadores ya no se meten uno dentro del otro.**
  Cada pana guarda su espacio en el ring y se separa suave si queda
  encima del otro; los golpes, el empujón y el agarre empujan igual que antes.
- **Ludo ahora se juega de cuatro a seis panas.**
  El anfitrión elige 4, 5 o 6 jugadores en la sala; con cinco o seis la mesa
  crece y trae un tablero redondo en estrella, con Morado y Naranja, y los
  puestos vacíos los juegan bots.
- **Pepazo estrena El Puerto: dos bases frente a frente en un patio de contenedores.**
  Una cancha de 116 m con el galpón en el medio, grúas pórtico y barcos en
  el muelle; cada ronda trae Pasillos, Fortaleza o Laberinto, y los bots
  ya cruzan el patio a buscarte aunque no te vean.
- **En Dominó nadie puede ver tus fichas.**
  El servidor reparte y juega los bots; a cada pana solo le llegan sus
  propias fichas, y las de los demás quedan boca abajo hasta que se cierra la mano.
- **Un pana que se queda quieto ya no congela Ludo ni Bolas Criollas.**
  Con «Tiempo por turno» (60 s por defecto) el bot juega por quien se fue;
  en Billar, si tu rival se va a mitad de mesa, el anfitrión vuelve a la
  sala desde el menú.
- **En Póquer nadie se queda con tus fichas usando tu nombre.**
  Si se te cae la conexión, solo tu propio navegador recupera tu pila.
- **La revancha en la misma pista de Carreritas trae cajas distintas.**
  Antes cada carrera repetía la misma secuencia de objetos.
- **Volver a un juego con el botón Atrás ya no lo deja congelado.**
  La página se vuelve a cargar sola; y los menús de Billar, Caída y Dominó
  ya suenan al tocarlos y respetan el volumen de la música.
- **Las carreras online de Carreritas ya no aceptan tiempos inventados.**
  El servidor solo da por terminada la carrera de un carro que llegó a su
  última vuelta y con un tiempo que cuadra con su propio reloj.
- **Escribir el código de sala en mayúsculas ya te lleva con tus panas.**
  La sala muestra el código en mayúsculas; antes, copiarlo así en «Tengo un
  código» abría una sala vacía aparte.
- **Carreritas tiene cuatro copas nuevas: Costa, Cumbre, Relámpago y Fantasía.**
  Las dieciséis pistas sueltas ahora también se corren como campeonato de
  cuatro carreras, con su trofeo; la lista de copas baja con scroll.
- **Bochinche tiene trece panas, cada uno con su poder en K, y un HUD nuevo.**
  El Trueno, La Medusa, El Silbón y diez más pelean con su disfraz y sus
  accesorios sobre tu propio pana. Placas con el daño en grande, vidas en
  bolitas, ¡Fuera! y cuenta regresiva a pantalla completa, y tres diseños
  del HUD en el menú (Clásico, Esquinas, Mínimo). Elige tu pana y su traje
  desde la sala (se recuerda para la próxima), y al final hay podio, tabla
  de KOs, caídas y daño, y premios como Pegada de oro.
- **Las peleas de Bochinche pagan mangos que gastas en el taller de Carreritas.**
  Ganas por puesto, por cada KO y por cada premio; los mangos ahora son de
  todo Pana, y tu saldo de Carreritas pasa tal cual.
- **Pana habla inglés: elige el idioma en Ajustes > Idioma.**
  El hub, las salas, los menús y todos los juegos salen en inglés si tu
  navegador está en inglés o si lo eliges; cada pana de una sala ve su propio
  idioma. Los nombres de los juegos, los dichos y las preguntas siguen en
  español. Para quien desarrolla: el texto pasa por `loc()` y
  `npm run i18n -- check` avisa de lo que falta traducir.
- **Stop trae paquetes de categorías, preguntas pa' reírse y categorías propias.**
  Elige entre once paquetes con flechas (Pa' los chamos, Geografía, Pa' reírse,
  Confiesa, Inventa…), escribe hasta tres categorías tuyas, junta Ciudad,
  estado o país en una casilla, y al final mira «Lo mejor de la noche».
- **Carreritas recuerda tu carro también al volver a una sala con tus panas.**
  Antes, entrar por el enlace de la sala te ponía El Chamo; y el acabado
  Camuflaje vuelve a pintar toda la carrocería, no solo el alerón.
- **Ajustes tiene cara nueva: categorías a un lado, una fila por ajuste y la explicación al lado.**
  Las flechas cambian cada opción, un punto verde marca lo que tocaste, y el
  panel muestra la curva del stick, el mando en vivo o lo que cuesta la imagen.
- **Ajustes > Imagen ahora separa resolución, sombras, detalle, límite de FPS y suavizado.**
  Nítida, Equilibrada y Rápida siguen como punto de partida; puedes ver
  FPS y tiempo de cuadro en pantalla, apagar el ajuste automático, y en
  partida la página avisa cuando un cambio necesita recargar. Parapente
  ya respeta la resolución elegida.
- **Para quien desarrolla: `npm run perf -- <juego>` mide cualquier juego por calidad.**
  Con `--tiers` mide cada ajuste por separado y con `--base` compara contra
  otro commit; los ajustes también van en el enlace (`?pana-shadows=off&pana-stats`).
- **Stop estrena categorías Variadas: profesión, deporte, cuerpo, casa, planta y película.**
  Más de 750 palabras nuevas que el juego reconoce solo, Mezcla reparte de
  los tres grupos, y «Pedro Pérez» o «Verde manzana» ya cuentan.
- **En Póquer, si te sales y vuelves, recuperas tus fichas.**
  Volver con el mismo nombre te devuelve tu pila; salirse ya no regala una
  pila nueva de 1.000 a quien iba perdiendo.
- **Colonia Tovar y Sarisariñama corren más livianos.**
  La niebla, el mar de nubes y la brisa se dibujan de una vez y el paisaje
  se recorta por zonas: Tovar pinta la mitad de triángulos y ya no se traba.
- **Stop recuerda las palabras que la mesa aceptó y deja elegir las letras.**
  Lo que se votó que sí cuenta solo en la próxima partida, las letras no se
  repiten entre partidas de la misma sala, y Letras: Fáciles, Normales o Todas.
- **En Stop una sola letra ya no cuenta, y tras ¡STOP! hay 5 segundos.**
  «P», «P.» o «Ppp» salen en rojo sin votación y no dejan gritar ¡STOP!;
  los demás tienen 5 s para cerrar la palabra, y Chrome no tapa la hoja.
- **El servidor cuenta lo que pasa en cada sala, para que los anfitriones vean qué falló.**
  Una línea por sala creada, pana que entra, se cae, vuelve o se va, cambio de
  anfitrión y cierre; `PANA_ROOM_LOG=0` la apaga.
- **¡Stop! se juega solo entre panas: apaga los bots desde el lobby.**
  Con «Jugar con: Solo panas» las sillas vacías quedan vacías: nadie más gira
  la rueda, escribe, vota ni sale en la tabla.
- **El Mango de oro siempre trae cuatro opciones y la narración no se corta.**
  Una pregunta sin exactamente cuatro respuestas distintas nunca llega al
  tablero, un audio que falla salta al siguiente en vez de callar el resto,
  y la respuesta correcta ya no viaja a los invitados antes de revelarla.
- **El mando que conectas es el que juega, aunque el PC tenga otros aparatos.**
  Un mando Bluetooth recién emparejado toma el control, y luego manda el
  último mando que tocaste; audífonos, hubs o volantes ya no se lo roban.
- **Batear en Chapita ya no es suerte: un aro en el plato te marca el momento.**
  Otro aro se cierra y se pone verde cuando llega la chapita, con tres tics
  de ritmo, el palo busca la altura solo (W/S si quieres elegirla) y cada
  swing te dice si fuiste temprano o tarde. Las bases forman un diamante de
  tiza con la segunda en la acera, los corredores dan la vuelta por las
  bases y los swings suenan a palo de verdad.

- **Chapita se llena de jugadas locas: el perro, el abuelo, la alcantarilla y más.**
  Veinte animaciones del estudio salen de jugadas reales (jonrón con bat
  flip, ¡PONCHAO!, la ventana con ¡CORRAN!, pinball contra el poste, ¡A
  comer!), con letras de cómic, sonidos y tomas de cámara. Un lanzamiento
  alto y pegado es un chapazo que te manda a primera; la opción «Pelota y
  bate» cambia el equipo, y Studio muestra cada jugada en bucle.

- **Ludo centra sus fichas y suena con efectos grabados.**
  Los saltos, vuelos y golpes usan muestras acreditadas en el paquete del
  juego; la nube de lluvia deja espacio para el mensaje y las fichas.

- **Ludo deja terminar cada jugada antes de anunciar el siguiente turno.**
  Los dados, movimientos y capturas tienen pausas legibles; al llegar tu
  turno, un foco ilumina tu esquina y oscurece el resto de la mesa.

- **Los ajustes usan los mismos nombres en todos los juegos.**
  «Jugar con» distingue «Solo panas» de «Panas y bots»; el nivel de bots
  usa Fácil, Normal y Difícil. Galope y Curiara comparten esa elección con
  la sala, Lancha y Parapente la separan del nivel, y los ajustes personales
  quedan separados de las reglas del anfitrión. Los tiempos indican qué miden.

- **Los panas de QQSMP piensan, celebran y se equivocan con nuevas animaciones.**
  Veintitrés variantes alternan bailes, lágrimas de alegría, mortales,
  berrinches y más; el concurso suma botones, accesorios, confeti y escenas
  cómicas, con efectos de sonido y respeto por el movimiento reducido.

- **QQSMP permite jugar solo con panas y ajusta las tarjetas de la sala.**
  Elige «Solo panas» para quitar los bots; los puestos vacíos no votan ni
  puntúan, y las tarjetas caben sin la barra de desplazamiento horizontal.

- **QQSMP suena a concurso con redobles, suspense y fanfarrias originales.**
  Cada pregunta, cuenta atrás, acierto, fallo y victoria tiene su sonido;
  los efectos bajan de volumen mientras habla el animador.

- **QQSMP revela la respuesta al votar el último pana y la anuncia en voz alta.**
  Puedes corregir tu elección mientras falte alguien; al completar los votos,
  el animador dice la letra y la respuesta correcta sin esperar el reloj.

- **QQSMP lee las opciones y permite cambiar o cancelar tu respuesta.**
  Escucha cada letra y respuesta en el orden de la pantalla; puedes corregir
  tu elección hasta que termine el tiempo, con el bono de tu última respuesta.

- **Ludo usa los veintiún momentos del estudio con efectos de sonido.**
  Turnos, suspense, escudos, salto de rana, recta final, reacciones y podio
  se suman a los diez movimientos del camino, con sonido y vistas en Studio.

- **Los botones de menú e invitación comparten el nuevo estilo del HUD.**
  Placas inclinadas y atajos legibles en todos los juegos, también en los
  controles de vista y detalles de Ludo.

- **Ludo deja ver el dado antes de mover y acerca la mesa.**
  Fichas compartidas más grandes, un HUD con pistas de cada jugada y detalles
  de los panas al mantener Shift o tocar «Ver panas».

- **Ludo estrena las fichas con caritas y los movimientos del estudio.**
  Tablero texturizado, fichas brillantes, dado redondeado y diez animaciones
  del camino en las partidas y en Studio, sin cambiar las reglas del dado.

- **Las imágenes grandes se distribuyen en paquetes separados por juego.**
  Pana verifica y guarda cada paquete al necesitarlo; los iconos y miniaturas
  siguen en Git, sin cambiar las ilustraciones ni sus direcciones.

- **QQSMP lee las preguntas en español y te da más tiempo para responder.**
  Voz grabada para cada pregunta, 30 segundos por defecto y opción de 45;
  las revanchas recorren el banco antes de repetir preguntas.
  Las grabaciones se descargan como un paquete aparte y no ocupan el historial de Git.

## 0.7.0 - 2026-10-24

- **Los panas y los escenarios se preparan más rápido al entrar a jugar.**
  La ropa reutiliza sus ajustes al cuerpo y los escenarios agrupan sus
  piezas con menos copias, conservando sus formas y colores.

- **Trifulca estrena patadas, barridas, volteos y golpes con más cuerpo.**
  I da una patada, U barre y O voltea al rival: gastan aguante y funcionan
  en línea, con botones táctiles y control. Nuevas poses y estallidos de
  cómic acompañan cada golpe.

- **En Carreritas en línea los carros de tus panas se ven fluidos.**
  Ya no tiemblan al avanzar: se mueven tan suave como el tuyo.

- **Chuao estrena un Chorrerón con cuerpo y la plaza ya no pisa la vía.**
  La cascada cae curva, con chorros, espuma y rocío; los cerros lucen más
  tupidos, y el patio de cemento y el cacao al sol terminan en el borde de
  la carretera junto a la iglesia.

- **Los 16 carros de Carreritas estrenan carrocería suave y cabina por dentro.**
  Faros, parrillas y adornos se apoyan en la carrocería curva, y cada carro
  trae tablero, asientos y volante alrededor de tu pana.

- **Carreritas corre más fluido sin cambiar su aspecto.**
  Las lanchas y avionetas se preparan en la pantalla de carga, sin tirones al
  llegar al río; los bosques lejanos y los panas rivales lejanos son fotos
  de sí mismos, y las sombras de los rivales usan solo sus piezas grandes.

- **Bolas Criollas permite bochar por el aire y ver dónde caerá la bola.**
  Ajusta la altura y sigue el arco hasta el aro de caída; otro blanco marca
  dónde frena. La guía sigue la fuerza y avisa cuando el tiro se va fuera.

- **Ludo mueve las fichas sin decisiones y reduce las rachas sin salir.**
  Los movimientos únicos y las salidas equivalentes son automáticos; la ayuda
  opcional interviene tras tres a cinco intentos fallidos, igual para todos.

- **Reliquia permite saltar con Espacio, control o toque.**
  El salto se comparte con tus panas; clic o V usa la mano derecha.

- **Trifulca responde a esquivar mientras preparas un golpe.**
  La esquiva cancela la carga inicial y el aviso aparece a tiempo para evitar
  el trompón, en vez de pedir una esquiva demasiado temprana.

- **Billar ofrece una mesa individual de uno contra uno.**
  Bola 8 y Bola 9 permiten elegir rivales individuales o mantener los equipos.

- **Carreritas muestra números mayores y controles visibles para lanzar atrás.**
  Las estadísticas conservan un tamaño legible; los botones de objetos también
  aparecen en escritorio y recuerdan el control X para lanzar hacia atrás.

- **Bolas Criollas distingue la ventaja provisional de una victoria.**
  El indicador dice quién va más cerca mientras quedan lanzamientos.

- **Ludo distingue los seguros y muestra juntas las fichas que comparten casilla.**
  Un doble borde y una leyenda aclaran dónde no se captura; las fichas se
  distribuyen lado a lado dentro de la casilla, sin taparse en una torre.

- **En Ludo cada pana se sienta junto al patio de su color.**
  Verde y azul dejan de aparecer intercambiados; los cachos y lanzamientos
  también salen del lado correcto de cada jugador.

- **Póquer muestra las cartas comunitarias en grande encima de la mesa.**
  Los valores y palos se leen de frente; tus cartas también crecen y la cámara
  deja espacio para la lectura en teléfonos, sin revelar manos ajenas.

- **Chapita muestra las bases y facilita batear sin perder atrapadas en línea.**
  Las bases numeradas señalan a los corredores; el lanzamiento deja libre el
  plato y el bateo tiene una guía de tiempo y más margen. Las atrapadas esperan
  la respuesta del defensor antes de conceder hits o carreras.

- **Carreritas recuerda tu carro y conserva los ajustes de cada carrocería.**
  Al volver se abre el último carro elegido; cambiar de carro ya no reemplaza
  la pintura ni las piezas de un vehículo que habías configurado.

- **Rápida reduce los efectos de Cosmos, Nubes, Volcán y Arrecife.**
  Simplifica los cielos, nubes y lava, apaga las cáusticas submarinas y reduce
  partículas, transparencias y actualizaciones decorativas sin cambiar la pista.

- **Rápida aligera los bosques de Carreritas y mantiene el ritmo de carrera.**
  Chuao y los demás circuitos con bosques compartidos usan árboles más simples
  al bajar la calidad; los cuadros lentos ya no frenan el carro por debajo de
  doce cuadros por segundo dentro del límite de recuperación de 250 ms.

- **Trifulca, Bochinche y Parapente estrenan ilustraciones propias.**
  Sus tarjetas y portadas usan arte nuevo; quince circuitos de Carreritas
  muestran ilustraciones en el selector, las miniaturas y la carga.

- **Los escenarios de Bochinche aprovechan los modelos de la biblioteca.**
  Los Roques incorpora cocoteros y casitas detallados; Salto Ángel, vegetación
  de selva; Catatumbo, mangles, redes, cajas de pesca y un peñero.

- **Billar muestra controles de tiro más simples y legibles.**
  Una sola indicación explica la carga; el mensaje de turno conserva su espacio
  y el botón Tirar se adapta a escritorio y móvil.

- **Los Roques llega a Bochinche y cuatro juegos estrenan HUD Banderín.**
  Salta entre el cayo, el muelle, la balsa y el peñero. Bochinche, Caída,
  Billar y Trifulca comparten placas, botones y resultados más claros; los
  indicadores muestran tus panas, vidas y puntuaciones reales.

- **Bochinche pelea en Salto Ángel y bajo los rayos del Catatumbo.**
  Escoge escenario en la sala: curiara móvil, muelle con avisos de rayos y
  ataques Rayo, Candela, Hielo y Jonrón con efectos y daño sincronizados.

- **Los pepazos tumban a tu pana en la dirección del impacto.**
  Las caídas animan el personaje propio con física de partículas y colisión
  contra el suelo y la cobertura; reaparecer restaura la pose. El Cohetón tiene
  un sonido sintetizado propio.

- **Los trompones de Trifulca conectan cuando se extiende el guante.**
  Golpes, agarres y poses comparten sus tiempos de contacto; los impactos
  ligeros tienen una capa de sonido más definida. El tutorial da dos segundos
  para practicar el contragolpe; las peleas conservan su ventana habitual.
  Un tirón de rendimiento ya no salta de golpe todo el aviso de un ataque.

- **Dominó verifica las jugadas recibidas y da personalidad a los bots.**
  La mesa reconstruye los cambios desde un registro de reglas, recupera
  segmentos perdidos y conserva la partida al cambiar de anfitrión. Los bots
  tienen ritmos y preferencias propios, probados en diez mil manos.

- **Carreritas da mejores oportunidades de remontar y un respiro entre ataques fuertes.**
  Las cajas consideran la distancia y el puesto, con más jugo y protección
  para quien quedó atrás. Aguacero y Chancleta no encadenan castigos sobre
  el mismo pana; los bots tardan en reaccionar y repetir una caja no mejora sus premios.

- **Prueba un rayo en la arena de Bochinche.**
  El laboratorio local permite comparar chispas, destello, pausa de impacto
  y sacudida de cámara, con cámara lenta y un golpe sin efectos.
  Los rayos tienen un núcleo blanco, resplandor azul y ramificaciones finas;
  el impacto usa una textura de luz suave y chispas.

- **Trifulca mantiene las cabezas estables y explica el estado de la pelea.**
  Barras inclinadas, retratos de tus panas, presentación VS y estadísticas
  reales al terminar. Mareo, aguante y caídas tienen etiquetas; el tutorial
  sigue tu mando sin duplicar controles. El mando cancela la vibración al salir o cambiar
  de ventana, y el enlace de salida no inicia otro pulso.

- **Mira los carros de tus panas antes de guardar sus kits.**
  La Parrilla muestra cada carro con su pintura y piezas reales; abre su
  ficha para verlo en 3D o guardar una referencia para el taller.

- **El taller de Carreritas muestra sus opciones sin tiras de desplazamiento.**
  Carros y colores en una sola fila de tarjetas, sin descripciones por carro;
  muestras grandes, etiquetas legibles y páginas de piezas; las cornetas
  solo muestran sonidos y la llama del turbo está en Pintura y estilo.
  La sala mantiene los asientos y ajustes dentro de la pantalla.

- **Revisa y copia los kits antes de entrar a la carrera.**
  La Parrilla aparece antes de preparar los gráficos; al llegar a la pista,
  solo queda la cuenta de 3, 2, 1, sin paneles tapando la salida.

- **El recorrido de Pana Studio sigue el peralte de las pistas.**
  La cámara conserva su altura en la curva inclinada de Plaza y sobre la laguna
  de Margarita; los puntos copiados incluyen la altura real del recorrido.

- **Carreritas suma Cosmos, Mérida, Arrecife, Volcán, Nubes y Dulce.**
  Corre entre planetas, montañas, corales, lava, islas flotantes y dulces;
  cruza la laguna de Mérida en lancha y comparte los seis circuitos con tus panas.

- **Los mangos, bucares y árboles de la selva tienen follaje más natural.**
  Nueve especies cambian las copas macizas por hojas y racimos abiertos,
  con menos geometría en los mapas y sin texturas ni dibujos adicionales.
  Los pinos y los árboles simples para el fondo conservan su aspecto.

## 0.6.0 - 2026-10-23

- **Las migraciones grandes reparten sus pruebas entre varios ejecutores.**
  CI conserva cada prueba aprobada y muestra los errores al ocurrir, sin
  esperar al final de una cola que puede superar el límite de tiempo.

- **En Trifulca el público sigue la pelea y celebra contigo.**
  Los panas del ring y los vecinos voltean hacia los golpes, se echan pa'
  trás con los trompones y saltan al final; cada quien se mece a su propio
  ritmo. Los golpes tambalean al que los recibe y los guantes, el toldo y
  los props se ven con borde de tinta (`?ink=0` lo apaga). La cámara de TV
  escoge sola el mejor lado cuando un peleador sale volando.

- **Los panas se achatan y se mecen como caricatura.**
  El personaje compartido tiene un resorte de squash and stretch:
  `bounce()` para aterrizajes y celebraciones, `stagger()` para tambaleos.
  Los caminantes del mundo ya lo usan al doblar; los juegos lo activan por
  evento, sin cambios para quien no lo llame.

- **Los sonidos ya no se montan unos encima de otros.**
  Hay un cupo de voces con prioridades en el bus de efectos: en los
  momentos cargados se oyen los golpes y la campana que importan en vez de
  doce ruidos a la vez. La música no se toca.

- **Los araguaneys y apamates tienen copas más abiertas y flores más finas.**
  Las ramas se ven entre racimos irregulares; los árboles de la carretera
  usan menos triángulos, sin texturas ni llamadas de dibujo adicionales.

- **Los araguaneys y apamates de Plaza cambian de floración y sueltan pétalos.**
  Las copas de la carretera alternan flores y verde por parches; los pétalos
  caen desde cada árbol en calidad media y alta, también en pantalla dividida.

- **Carreritas prepara los gráficos por etapas antes de la salida.**
  Las texturas y el paisaje inicial se suben en tandas mientras la pantalla
  de carga sigue respondiendo; las repeticiones reutilizan la preparación.

- **En el Páramo caen copos que flotan con el viento y se asienta la nieve.**
  La nieve cubre gradualmente las caras superiores del terreno, la vegetación,
  las rocas y la cabaña; los copos se adaptan a cada cámara y nivel de calidad.

- **Pana usa Three.js r186 en todos los juegos y el editor.**
  El motor gráfico comparte la versión 0.186.1, con sombras y temporizadores
  actualizados. Para jugar hace falta un navegador con WebGL 2.

- **Todos los juegos comparten el menú lateral de Carreritas.**
  La sala conserva sus ajustes, equipos y controles de listo en una misma
  estructura; cada juego mantiene su propio marcador durante la partida.

- **Bochinche reúne hasta seis panas en una pelea de plataformas 3D.**
  Combate de Super Bash Folds con vidas, saltos, escudos, agarres y objetos;
  juega por enlace con tu propio pana y tres estilos de pelea. Elige de 2 a 6
  luchadores; los bots llenan los puestos vacíos y gana el último con vidas.
  La arena tiene vegetación Pana, golpes con poses y efectos, cámara suave
  y un marcador que separa daño, vidas y escudo; Pesado gana fuerza y aguante
  a cambio de velocidad.

- **El salto de San Carlos recibe el carro sobre la carretera.**
  La recepción empieza antes y sigue la dirección de salida antes de doblar;
  el hueco más corto evita caer al terreno debajo de la pista.

- **Las franjas verdes de turbo tienen bordes definidos y luz en movimiento.**
  Una textura pequeña compartida dibuja los bordes y las flechas; el material
  anima la luz sin añadir modelos, descargas ni luces dinámicas.

- **San Carlos te lanza por un cañón gigante hacia la bajada.**
  La rampa baja de altura, alarga su entrada y alinea sus barandas con la pendiente;
  el cañón abierto, sus luces y las flechas marcan el despegue y la recepción.
  La garita que atravesaba el salto deja libre el corredor de vuelo.
  Los lotes de contenedores junto al túnel tienen alturas y espacios distintos.

- **La carrera deja la carretera libre de instrucciones permanentes.**
  La guía completa de teclado y mando sigue disponible en el menú de pausa.

- **La Guaira despeja la salida y coloca sus flechas dentro del túnel.**
  Los letreros se montan sobre la cara visible de la pared; los objetos para
  romper quedan en tramos del pueblo y las torres de luz salen de la carretera.
  Un contenedor en movimiento y los peñeros meciéndose dan vida al puerto,
  con más contenedores junto al túnel y un horizonte más abierto al Caribe.

- **La Guaira abre su bajada al túnel y renueva el recorrido submarino.**
  El muelle ya no cruza la entrada; cristales azules, arcos luminosos y una
  franja verde de turbo acompañan la curva bajo el puerto.

- **La entrada de San Carlos tiene su bóveda despejada.**
  El techo curvo queda sobre el portón, sin atravesar el paso del castillo.

- **Las cajas de objetos muestran un mango grande y claro por sus cuatro lados.**
  Conservan la madera y su animación al romperse, con menos piezas y una sola
  malla de colores compartida para reducir el trabajo de dibujo.

- **Los carros se inclinan con la carretera desde el momento de colocarlos.**
  Las vistas de revisión y las posiciones de salida respetan la pendiente y
  el peralte sin necesitar que el carro avance primero.

- **Bululú estrena laderas rocosas, luz de sol y una zona de turbo más visible.**
  Las cimas conservan su vegetación; las flechas verdes anuncian el impulso
  hacia el mirador y las líneas de velocidad acompañan la aceleración.
  El modo de cámara suave desactiva las líneas y el resplandor de pantalla.

- **Bululú enlaza el pueblo, el faro y la playa con subidas y curvas peraltadas.**
  Dos miradores, un faro más visible, grupos de palmeras y nuevos tramos de
  piedra dan ritmo a la vuelta; la cámara más baja acompaña las lomas y el
  banco de arena conserva su marea y su paso abierto.

- **La curva de regreso de Casas Botes tiene una inclinación real en Plaza Pana.**
  El borde exterior sube de forma gradual y vuelve a nivel antes del siguiente
  giro; la carretera, el terreno y el apoyo del carro comparten el peralte.

- **La loma de Plaza Pana comparte su altura real con el terreno y las plantas.**
  Los apoyos consultan los mismos triángulos que se dibujan, también
  en el borde de la loma, para evitar diferencias al salir de la pista.

- **Los bordes de Salinas se distinguen mejor del terreno claro.**
  La franja de tierra rosada delimita la carretera sin añadir barreras
  ni cambiar el paso por el agua y la mina.

- **Selva y Bululú enmarcan mejor sus curvas con grupos de árboles.**
  Las copas de la meseta alternan tamaños y los cocoteros dejan una apertura
  hacia el mar, conservando el espacio de la pista y sus referencias.

- **Los carros acompañan la inclinación lateral de la pista.**
  El apoyo de ambos lados orienta el carro sobre las curvas inclinadas;
  los saltos conservan su giro en el aire.

- **La cámara anticipa las curvas y ofrece un modo suave.**
  Dinámica acompaña el camino con una inclinación leve; Suave elimina la
  inclinación, las sacudidas y el zoom del turbo desde Ajustes → Carreritas.
  La preferencia de movimiento reducido del sistema también activa ese confort.

- **La revisión de pistas guarda vistas de conducción y comprueba una vuelta automática.**
  La herramienta de auditoría registra geometría, cámara y costes de dibujo
  por circuito para comparar mejoras con las mismas condiciones; también guarda
  secuencias de conducción con reproducción y avance por fotogramas.

- **Veinte rincones de Derrape tienen nuevos jardines, árboles y referencias de camino.**
  Plaza, Selva, Páramo, Bululú y Gran Sabana enmarcan curvas y vistas con
  vegetación y rocas propias de cada paisaje, sin cambiar el trazado ni la cámara.

- **La vuelta de Casas Botes en Plaza Pana revela el pueblo entre árboles.**
  Una loma plantada con mangos enmarca la curva sin cambiar el trazado,
  la cámara ni la visibilidad de los bordes de la pista.

- **Carreritas y Pepazo comparten una sala con tus panas, kits y conexión a la vista.**
  Tu tarjeta cambia Listo; los ajustes usan las mismas placas y puedes abrir
  tu taller o kit antes de arrancar. Sin conexión puedes jugar en local o
  reintentar. Pepazo calcula el nivel del kit con sus estadísticas reales.

- **Elige entre 22 pistas, copas y globos, y revisa cada vehículo de la parrilla en 3D.**
  El taller vuelve a Pistas; las copas muestran sus cuatro etapas y trofeos.
  Abre un carro, lancha o avioneta para girarlo, verlo de cerca, guardar sus
  piezas como recomendación o copiar sus colores. Los precios individuales
  cuentan solo piezas que faltan, sin cobrar otra vez las que ya tienes.

- **Carreritas carga el taller sin construir los menús que ya no se usan.**
  El garaje conserva el diseño del nuevo taller, con sus vistas 3D y guardados.
  Quitamos controles y dibujos ocultos, actualizamos los consejos de carga y
  probamos las compras, los cauchos y los carros desde los controles visibles.

- **Tu pana conserva sus proporciones al cambiar de carro.**
  El asiento ajusta al personaje completo sin encogerle la cabeza ni alargarle
  el cuello. Solo cuentan los accesorios que lleva puestos; cambiar de
  cauchos ya no cambia el tamaño del piloto.

- **El mando mantiene sus ayudas al conducir y los controles comparten Ajustes.**
  Los sticks lentos y los botones sostenidos se detectan sin que mover el
  ratón cambie las ayudas. Cada dispositivo reúne instrucciones y sensibilidad;
  las opciones adicionales se despliegan cuando las necesitas.

- **La Parrilla muestra la salida en 3D sin menús del garaje encima.**
  Copa, Taller, Ajustes y la fila de carros se ocultan durante la preparación.
  ¡Listo! espera a los panas sin dejar la pantalla vacía.

- **Ajusta tus controles en una pantalla completa para todos los juegos.**
  Pana sigue el ratón, teclado, mando o pantalla táctil que estés usando y
  cambia las ayudas. Guarda sensibilidad por dispositivo, ejes verticales,
  zona muerta, curva y vibración del mando; prueba sus sticks y botones en vivo.
  Audio, imagen y opciones del juego comparten el mismo centro de ajustes.

- **Los zamuros de rescate liberan su geometría al terminar la carrera.**
  Encadenar copas ya no conserva las mallas de los rescates anteriores.

- **Los cables entre postes vuelven a verse en Pana Studio.**
  La vista previa respeta los dos extremos del cable al llamar su modelo.

- **Arma tu kit de Carreritas con el carro, la lancha y la avioneta a la vista.**
  El taller estrena ranuras, compras directas y comparaciones de nivel. La
  parrilla revela los kits y deja copiarlos al taller; los resultados muestran
  tu carrera y las monedas se convierten en mangos en una caja de verdad, en 3D.
- **Pepazo estrena armería completa y un campo para probar tu kit.**
  Elige Chispa, Trueno, Gemelas o Cohetón; combina dos accesorios, protección,
  granada y estilo. Cada mejora tiene su costo en movilidad, recarga o control,
  y los kits funcionan tanto con amigos como contra bots.

- **Las lanchas y las avionetas ahora se manejan con sus propias estadísticas.**
  Cuando tu carro se convierte en el agua o en el aire, la pieza del kit que
  llevas manda: cada una tiene su punta, arranque, manejo, agarre y peso. Y
  ya no todos cruzan en el mismo peñero: tus rivales estrenan curiaras,
  lanchas de carreras, guacamayas y turpiales.
- **Derrape ahora se llama Carreritas.** Mismo juego, nuevo nombre en el hub y
  en la pantalla de carga: tus trofeos, mangos, carros, cauchos y fantasmas
  vienen con el cambio. La dirección nueva es /g/carreritas/.
- **El Aguacero de Derrape ahora moja a todos tus rivales.** Les cae a todos
  casi a la vez, 5 segundos de pista mojada y resbalosa, y a cada uno se le
  cae el ítem que tenía en la mano. Ves la lluvia en tu pantalla cuando te
  toca a ti, en vez de una nube sobre cada carro.
- **En Derrape, Galipán ahora también se corre por el aire.** Saliendo de
  Boca de Tigre bajas por un cañón de roca hasta el borde del cerro, tu
  carro se vuelve avioneta y das una vuelta sobre Caracas pasando por aros
  dorados, con los mismos controles, hasta aterrizar en la terraza de los
  girasoles con un turbo. Tierra, agua y aire en la misma carrera.
- **Nuevo juego: Parapente. Salta del Ávila con tus panas y vuela sobre Galipán.**
  Pasa las cinco balizas (la Cresta, el Pueblito, el Mirador, el Bosque y
  los Girasoles), sube en las térmicas donde dan vueltas los zamuros,
  atraviesa los aros dorados y aterriza en la diana de Boca de Tigre.
  Acelerador, frenos y orejas en el teclado, el control o la pantalla;
  hasta 8 pilotos y los del cerro completan la rampa.
- **Las plazas y el Mercado se ven igual y cuestan menos trabajo de dibujado.**
  Los puestos, bancos, barriles, cajas, cavas, matas y faroles comparten sus
  superficies por material: los 26 puestos del Mercado bajan de 2.080 a 208
  llamadas de dibujado. Bolas Criollas también instancia las matas y los
  faroles repetidos de la cancha, sin moverlos ni cambiar la partida.
- **Derrape estrena pantalla de carrera: letreros pintados en vez de cajas.**
  Tu puesto va en una placa amarilla, la clasificación aparece solo cuando
  pasas a alguien o te pasan, el velocímetro es una aguja con marca de pico
  y los nombres sobre los carros son banderines con el puesto, que se
  achican con la distancia. Vuelta final, vuelta rápida, derrapes y
  contramano tienen avisos nuevos, y las teclas solo se ven al arrancar.
- **En Derrape, la laguna de La Restinga y la del Delta se cruzan en lancha, por donde quieras.**
  La carretera baja por una rampa al agua y desaparece: navegas libre entre
  manglares e islotes, esquivas los peñeros de turistas (sus olas te hacen
  saltar) y dos botes de chigüires pescando, y subes por la otra rampa.

## 0.5.0 - 2026-10-21

- **Contributors get one-command scaffolds and safer checks.** `npm run
  new-track` registers a Derrape circuit everywhere with a placeholder that
  already races, `npm run launcher-art` adds a game's hub art, `npm run
  budget` shows each game against its size caps, and a two-second pre-commit
  hook catches the conventions that most often turned `dev` red. Browser runs
  tell known failures from regressions (`--baseline`), and releases merge
  back into `dev` on their own.
- **Derrape: barriles y cajas para reventar, nombres sobre los carros y El
  Chocón.** Por las orillas hay barriles y cajas del mercado; atraviésalos y
  salen volando, aunque te frenan un poco. El que más choque en la carrera se
  lleva el título de El Chocón en los resultados. Al acercarte a otro carro
  ves su nombre encima, y el fantasma también se vuelve lancha en el río. El
  derrape ahora suena: chirrido que sube con la carga, campanita en cada
  nivel, avisos antes de quemar los cauchos y el motor fuera de borda en el
  agua.
- **Los primeros circuitos de Derrape estrenan carreteras.** El asfalto ya no
  es morado y liso: tiene grietas, parches y rayas de borde, con doble raya
  amarilla en la montaña de Chi Chi y el Páramo y postes reflectivos en las
  curvas. Los caminos de tierra de Desierto, Selva y Llanos tienen huellas,
  piedritas y matas en el medio, y la arena de Bululú y Salinas lleva marcas de
  cauchos. El suelo cambia de tono, con orillas gastadas junto a la vía, y
  los cerros lejanos tienen más bosque.
- **Derrape: el turbo del derrape cuesta más y se castiga el abuso.** El
  naranja y el púrpura tardan más en cargar y pagan menos; si te quedas en
  púrpura demasiado tiempo las chispas parpadean en rojo y luego se queman
  los cauchos: pierdes la carga y frenas. Cada turbo calienta los cauchos y
  el siguiente derrape carga más lento. Las chispas y el humo ahora brillan
  como de verdad, sin los bloques de antes, y lo mismo el fuego del turbo,
  las chispas de los choques y el brillo de las monedas.
- **Derrape suma Isla Margarita, Sarisariñama y Gran Sabana.** Sal del castillo
  de Pampatar hasta Playa El Agua y los manglares de La Restinga; baja en
  espiral por la sima del tepuy, cruza las cuevas por debajo y sube a la luz;
  y corre por la sabana entre moriches y tepuyes, por la Quebrada de Jaspe y el
  Salto Kama, mientras el aguacero de la tarde llega desde el este. El aguacero
  es paisaje: no cambia el agarre.
- **Derrape: en Choroní y en la quebrada de Chuao tu carro se vuelve
  lancha de verdad, con tu pana al timón.** En Chuao el cambio llega justo
  bajo el salto de agua. Al tocar el agua el carro salta,
  desaparece en una corona de gotas y cae convertido en peñero, levantando
  su cola de agua; al salir del agua vuelve a ser carro. Derrapar sobre el agua carga el turbo más
  rápido. Los estilos de derrape ahora sí suman puntos en las curvas, y el
  fantasma guarda bien tu vuelta final.
- **Derrape estrena tres circuitos: Colonia Tovar, Galipán de noche y
  Maracaibo · El puente.** Sube entre pinos, hortensias y neblina hasta el
  pueblo alemán; cruza de noche el pueblito iluminado de Galipán con Caracas
  brillando abajo; y pasa el puente sobre el lago, los palafitos y La Chinita
  bajo los relámpagos del Catatumbo. Los árboles son los del catálogo de Pana
  y los tres circuitos funcionan en carreras rápidas, salas en línea y Studio.
- **Derrape: tu mejor vuelta corre contra ti.** Al terminar una carrera se
  guarda tu vuelta más rápida en cada pista, y la próxima vez un fantasma
  translúcido de tu propio carro la repite contigo — no choca ni cuenta en las
  posiciones. El HUD muestra «Fantasma» con el tiempo a batir; con `?noghost`
  se apaga.
- **¿Quién empieza? Every table game now opens with the cachos.** All panas
  shake a leather cacho at once, slam it and lift together; the highest die
  starts, ties shake again, and a strip shows the order. Ludo, Bululú, Caída,
  Póquer and Billar use it, Dominó offers it next to its own rule and Bolas
  criollas flips a coin. Hosts can pick Al azar, El anfitrión or Revancha (the
  last place starts) in Más ajustes.
- **Derrape se ve como se siente derrapar: el caucho queda marcado en la
  pista, el humo crece con la carga del derrape y soltar en púrpura frena el
  mundo un instante.** Las marcas de los cauchos se desvanecen solas en unos
  segundos; el humo sigue los colores de las chispas (polvo, azul, naranja,
  púrpura); la cámara lenta es solo local y nunca toca el reloj de las carreras
  en línea.
- **Derrape suma puntos de Estilo por derrapar: velocidad, carga y lo cruzado
  que vayas dan más, y encadenar derrapes sin pasar tres segundos en recta
  sube el combo (×2, ×3…).** Un medidor sobre el velocímetro muestra el combo
  en vivo y celebra cuando los puntos se guardan; chocar nunca quita puntos,
  solo corta la cadena. Al final de la carrera cada carro muestra su línea de
  Estilo y el que más sumó se lleva el ¡Rey del Derrape! — el podio no cambia:
  el estilo es sabor, no ventaja.
- **Tests can be narrowed and explain themselves: `npm test -- derrape` runs
  only the matching unit tests in seconds, and `.\dev.ps1 check -Help` prints
  the cheat sheet for picking the fastest check.** The full unit run still
  works as `npm test`; browser suites stay filtered or `--changed`, never the
  whole set locally.
- **Derrape y Pepazo celebran tus jugadas con avisos de hitos.** En Derrape el
  derrape suma metros por carrera (¡500 metros!, ¡1 kilómetro!), un derrape de
  más de 100 m sin soltar es un ¡Derrapón! y soltar un derrape púrpura tiene su
  celebración. En Pepazo pintar a un rival lo anuncia por nombre, y dos o tres
  pintadas en menos de cinco segundos cantan ¡Doble pintada! y ¡Triple pintada!.
- **New game: Trifulca, barrio boxing where the winner stays and everyone
  else is the ring.** Two panas fight with jab, trompón, block, dodge and
  grab; hits fill your mareo instead of a health bar, three caídas is a
  K.O. and the judges read the card at the bell. Panas waiting their turn
  shove fighters back in, bet dolitas, give water in the corner and can
  shout ¡cálmate!. Seven arenas: la calle, el toldo, el mercado, the
  plaza de las motos at night, a manga de coleo with a loose bull, a zebra
  crossing under the lake bridge and a colonial street, with a TV narrator, intro cards and a
  slow-motion replay. Also Trifulca libre (four at once, with chairs and
  chancletas to throw), Parejas (tag your partner) and a Torneo whose final
  is fought under the tent. A first-time tutorial teaches every move with
  the profe, and alone you climb a ladder of five rivals instead of watching
  bots fight; a side camera, a lit key bar and ¡ESQUIVA! prompts make it
  easy to read.
- **Derrape keeps detailed roadside trees while distant forest costs less to render.**
  Three vegetation zones preserve planting density: native trees near the route,
  simplified trees farther out and lightweight crowns on distant hills. Isolated
  trees and palms retain their visible trunks.
- **Race through Cata, Choroní and Chuao, including the downhill quebrada.**
  Three coastal circuits join quick races, online rooms and Studio with native
  Pana trees, dense mountain forest and previews of the actual maps. Existing
  circuits gain continuous road wear and sloping verges; natural landscapes
  gain simplified background trees without filling towns, caves or salt pans.
- **Reliquia is now a first-person treasure run: ¿nos vamos ya, o bajamos
  un piso más?** Grab a farol at the camp and ride the montacargas down
  La mina del sol. It is one cage for everyone: it takes time, carries
  whoever stands on it, and has to be called back when someone else has
  it, so the team rides together or takes turns. Carry gold back to the
  truck in your hands (a handful of coins or emeralds, a mask, an idol)
  or load it into a carrito and push it there, its balance floating
  above it. The big treasures (the sun disk, the emerald chest, the gold
  jaguar, the cacao altar) need two to four panas walking together.
  Throw loot to a friend (hold E to catch it), drag a fallen pana to the
  truck, and shout votes with 1–7. Every run deals new floors from a
  shuffled room deck: trap halls, crypts, a rope bridge over a pit, a
  hidden room only the echo mask can hear, the sun guardian and a golden
  jaguar in the vault. La codicia rises with every treasure you lift:
  traps quicken, tunnels cave in behind you and a black jaguar starts
  hunting the team. Mummies, guácharos, ceiling spiders and coiled
  cuaimas guard the ruins, and eight enchanted artifacts help and ruin
  you in equal measure. Only what reaches the truck counts; if everyone
  falls, most of it stays in the ruin. Each jornada asks a quota: fill the
  carrito, send it up the cargo lift, then ride the montacargas up to
  finish it (whoever stays below comes back with 1 HP). Loot turns into
  mangos at the camp's shop (a paintball marker among the gear), and the
  next jornada is deeper. Point the crosshair at what you want to use.
  Below, everything echoes: footsteps, drips, creaks, distant moans,
  groaning mummies, hissing cuaimas and your own heartbeat when la
  codicia runs high.

## 0.4.0 - 2026-10-19

Maintenance release: no changes you will notice.

## 0.3.1 - 2026-10-18

Maintenance release: no changes you will notice.

## 0.3.0 - 2026-10-18

Maintenance release: no changes you will notice.

## 0.2.0 - 2026-10-17

### Added

- **Pepazo has a night map: Cancha de Noche.** Red floodlights, purple
  UV light and glowing LED rope lines light a field of pallets,
  inflatable bunkers, plastic tubes and a lookout tower. Paintballs glow
  as they fly, splats shine in the dark, and a headlamp lights the way in
  first person. Three layouts rotate by round: Torre, Inflables and Tubos.

- **Bululú parties come in short and minigame-only.** Pick 5 rounds for
  a quick party, or *Solo minijuegos* to skip the board and play
  minigames back to back. Any minigame can be practised alone from the
  lobby, and bots take their board turns faster, so a 10-round party is
  about a third shorter. The lobby now explains the final bonus and
  mango stealing before you start.

- **Race lanchas with an outboard motor in the new game Lancha.** Hold W
  for gas and steer with A and D (no rhythm, nothing to mash) down the
  Caño del Sipapo, over the Raudales de Atures and across the open Orinoco
  to Puerto Ayacucho. Straight jumps, the chorro and the toninas fill a
  turbo; caimanes bite your motor dead. Up to 8 panas, river drivers fill
  the start, and an automatic throttle makes it playable for anyone.
- **Both river races help you find the way.** A gold guide drawn on the
  water around your boat points at the best line and a trail of arrows
  follows it, steering round caimanes that now swim across the open river.
  Coral and green buoys mark the channel where the river opens up. In
  Curiara, holding W paddles for you while A and D steer, and mashing the
  keys now says plainly that it slows the canoe.
- **Build your pana with the new visual wardrobe and use the whole look in games.**
  Mi pana now has accessory previews, outfits, face details, prints, neckwear,
  backpacks, undo/redo and portable outfit codes. Existing avatars migrate;
  saving carries every slot and color through multiplayer and portraits.

- **Pepazo is a first-person shooter now, on bigger maps.** You look
  through your pana's eyes with the marker in hand: the mouse aims (click
  the court to capture it, Esc lets go and opens the menu), WASD walks
  where you look, and phones drag to look while Pinta sticks to the rival
  in front of you. Every court is 1.5× larger with an outer ring of
  barricades, paint splats on the cover it hits, and a corner map shows
  your team plus the rivals you can see. New map: **Muelle de La Guaira**,
  a container yard under the port crane, with the cargo ship at the quay
  and a colonial street of houses and stalls. "Ver la cancha" keeps the
  overview camera.
- **Pepazo hits feel like hits.** It takes three pepazos to knock a pana
  out (Aguante: 1, 3 or 5 in the room options) and the paint washes off
  after a few quiet seconds. Stains stick to the pana's body, they flinch
  on each hit and topple in a paint burst on the knockout. Every knockout
  calls out the distance ("¡Pepazo! Coco · 23 m"), with ¡Tiro largo!,
  ¡A quemarropa!, ¡Doble!/¡Triple!, ¡Imparable! and ¡Venganza!, a hit
  marker, a kill feed and new sounds for shots, hits and knockouts.
  Every map has three fixed layouts (Clásica, Girada, Cerrada; Muelle:
  Patio, Laberinto, Torres) that change each round.
- **Escondidas is first person on bigger maps, and Pepazo can sprint.**
  Seekers aim at the suspicious object and click: one hit and the hider is
  found ("¡Te encontré! Lola · 5 m"), a miss waits 1.6 s. Hiders see from
  their disguise's height and press V to check it from behind. Every
  Escondidas map is 1.5× larger with twice the props. In Pepazo, Shift
  sprints for three seconds (no shooting while you run), and Tab shows the
  table in both games. Mouse sensitivity is one shared setting.

- **New game: Chapita.** Barrio baseball with a bottle cap and a
  palo de escoba for up to eight panas in two teams, bots in the empty
  seats. The pitcher picks in secret: Planea (floats, rises at the end),
  Cae de golpe or Curva, aimed on a 3×3 grid, with a flat or a bent cap
  that wobbles more. The batter reads it and swings on time at the right
  height; where the chapita lands is the hit: past the sidewalk is a
  sencillo, the parked car a doble, the lamp post a triple, over the
  roofs ¡jonrón!, short of the acera an out. Fielders catch on a closing
  circle; miss up close and it's a chapazo with a tuyuyo on your head.
  The señora's window, house rules on a ruleta (carro que pasa = tiempo,
  azotea = out…), cuarto bate, Willy Mays, zurdos, apodos on every
  franela, titles at the end, a ¡Jonrón! derby, and two fields: the
  barrio street and the blue court under the superbloques.

- **New game: ¡Stop!** The notebook word game at a plaza table for up to
  eight panas, with bots in the empty chairs. The turn pana stops the
  letter wheel with ¡Para!, everyone fills a secret notebook page (the
  others only see how many boxes you filled), and the first full sheet
  yells ¡STOP!: "¡Basta! 3… 2… 1…" and pencils down. Then the review, one
  category at a time: words the game knows count on their own, wrong
  letters and blanks don't, and the doubtful ones go to "¿Eso cuenta?" with
  thumbs up or down (a tie favors the author). 100 for a word nobody else
  wrote, 50 when shared, +50 Creatividad when the table loves it, and the
  table remembers what it accepted. Clásicas, Criollas, Mezcla or Al azar
  categories, Stop rápido, hard letters and a "más criollo" option. It
  runs on El Saber, a new shared list of 1,600+ Venezuelan words with
  explanations ("Pichirre = tacaño") that other games can use too.

- **New game: La Rueda de Tambor.** A tambor party on the beach by the
  pink shack (or the malecón at night) for up to eight panas, with bots on
  the drums and in the crowd. Drummers keep the beat on four stations
  (Palo, Mano, Charrasca, Caracol) and fill the Sabor; two dancers follow
  the MCP's calls (¡Cadera!, ¡Vuelta!, ¡Pañuelo!, ¡Pégate!, ¡Abajo!,
  ¡Golpe!) and three misses get you "¡Sal de la rueda!"; la gente claps
  for Bulla and can cut the line once. Roles rotate every song, titles
  close the game. Also Relevo, Toque libre and ¡Golpe! (repeat the MCP's
  pattern or you're out). Music plays and is judged on each pana's own
  computer, so voice-chat lag never ruins anyone's timing.

- **New game: ¿Quién quiere ser mi pana? (QQSMP).** A TV trivia show in
  the plaza at night for up to six panas, with bots in empty podiums.
  Everyone answers at once and answers stay secret until the host reveals
  them by name, so "puse la B" on voice chat may be a bluff. Climb twelve
  steps of mangos (4 and 8 are safe), use Copiarse, Mitad y mitad, Doble o
  nada and Plantarse once each, then bet your mangos on the final question
  for the Mango de oro. The hub card can now show a short name (QQSMP)
  while the banner keeps the full one.

- **You throw the dice now, con arrechera.** In Ludo and Bululú hold the
  button or Space to shake the dice and let go, or flick them across the
  table: the harder you shake or flick, the wilder they fly and bounce
  before landing on the number. Every pana in the room sees the same throw.

- **The dice decide who starts.** Ludo and Bululú open with everyone
  throwing one die; the highest goes first and a tie throws again.

- **Eating a ficha in Ludo hits harder.** Fichas hop cell by cell; the one
  you land on flies home spinning, the panas at the table cheer and rage,
  and a callout says who ate whom.

- **Bolas Criollas charges its throw like Billar.** Hold Lanzar or Space and
  the force rises and falls; let go to throw. The slider is gone, and
  Bululú's Bolas Criollas minigame works the same way.

- **The dominó table talks back too.** Open with the double six and you
  salí con la cochina; doubles, a last tile, a pass ("Ando limpio", then
  "Más aburrido que mocho en piñata"), ¡Dominó!, ¡Capicúa! and ¡Tranque!
  pop over the pana who did it, and quick chat now shows over the speaker.
  The results wait a moment so you can see the last shout.

- **The panas at the Caída table talk.** A comic bubble pops over whoever
  just dealt, sang a canto, made a caída or swept the table, and the
  victim answers back ("¡Me agarró fuera de base!", "Más salado que pescado
  en Semana Santa"). Everyone at the table sees the same line.

- **Every town's houses come from the Creador de casas.** Derrape's Plaza
  and canal villas, Puerto, Bululú (Chinazo's patio included), Chichí and
  the shared plaza now wear the maker's grilles, lanterns, roofs and wall
  finishes, and the brick finishes are big enough to see from the road.

- **Derrape's Taller is a showroom you shop in with mangos.** The Taller
  page opens with the garage panel docked beside the car: live stat bars,
  one row of tabs and two columns of parts with their stat pills and mango
  prices. Coins you pick up in a race are exchanged one for one for
  mangos at the finish, plus the podium and trophy prizes.

- **Every map grows the new Árboles Pana trees.** Mangos, ceibas,
  araguaneyes, apamates, cocoteros, moriches, pinos, mangles and the selva
  giants are rebuilt with real branching limbs, leafy clumps, fruit and
  flowers, and they sway in the wind. Samanes shade the Plaza parks and the
  Llanos pastures, and Selva adds yagrumos, cacao, tree ferns and walking
  palms. Pana Studio lists all eighteen species.

- **Every sign on Derrape's circuits is a cartoon wooden board.** Track
  names, the META gantry, shop fronts and warnings use chunky lettering that
  always fits its board, and feather flags replace the blank pennant panels.

- **Build your room with the same quick settings and Más ajustes menus.**
  Hosts can choose the prototype's playable rules, maps, timers and team
  formats, with live updates for guests and a one-click reset. Join or swap
  teams through the same grouped pana cards. Más ajustes ends the settings
  panel, and start controls stay visible on small screens. Caída offers
  Individual or Equipos and adjusts its seats as friends join.

- **Bring six panas to Billar, Bululú, Caída, Dominó and Bolas Criollas.**
  Billar supports two teams of three with rotating shooters, Bola 9,
  called pockets and multi-rack matches. Bululú's board and all twelve
  minigames support six players; the other table games rotate every seat.
  Games with eight-player rooms retain them; Ludo keeps four colours.

- **Derrape's circuits are dressed for a fiesta.** Eleven tracks have warm
  golden sunlight, a glowing sun halo and brighter skies, roads and grass.
  The roadsides have araguaney, apamate and bucare trees in bloom, flower
  beds, balloons, bunting, checkered banners and ice-cream carts. Flocks of
  macaws and scarlet ibis and morpho butterflies fly overhead, and rounded
  far mountains, tepuys and hot-air balloons make each map feel bigger. The
  fiesta props, apamate and bucare trees are in Pana Studio too.

- **Cuevas del Río opens through rock arches, and cliffs look warm and rounded.**
  The cave roof is closed, with light falling through two small skylights,
  and every map's cliff faces lose their dark stripes.
- **Pana Selva is twice as long, with a jaguar cave and a plateau.** Climb
  through a cave with a temple pyramid, a cenote and two jaguars, cross the
  flower plateau, come down a timber ledge and splash through the ford.
- **Salinas del Viento is twice as long and dives into a hidden salt mine.**
  North of the flats the road plunges down a salt cut into a closed tunnel:
  three dim halls of glowing crystals, salt pools, a waterfall and a plank
  shortcut, then climbs back into the sun.

- **Time your release to control shot strength in Billar.**
  Hold the shot button or Space/Enter to reveal a rising and falling power
  meter, then release to shoot. The red zone delivers the strongest shots.

- **Eight new cars and a real Taller in Derrape.** La Pulga, El Caprichoso,
  El Por Puesto, El Burro, El Chigüire, La Chispa, El Tepuy and La Reina join
  the grid with rounded toy bodies. In the Taller you can try a body, wheels,
  motor, alerón, front bar, roof cargo, roll cage, finish, accent, rims, decal
  or stripes on the turntable before buying; each part shows its "+2 Vel" on
  the stat bars and changes the car a little in every race, online too.

- **Jaguars, glowing cave crystals and foaming cascades in Pana Studio.**
  A prowling, sitting or black jaguar, a carved stone jaguar statue and
  lintel, rainbow crystal clusters that pulse, cave skylights with dust
  and rain, and streams that whiten down their steps, ready for new maps.

- **Aim from behind the cue ball in Billar, and play Pana Bot on four difficulties.**
  The new default camera bends over the shot like the player would, with a tall
  power bar, a spin pad for follow, draw and side english, and a camera button
  (C). Fácil shows where both balls go, including rebounds; Experto shows only
  the cue's direction, and Pana Bot aims better as the difficulty rises.

- **Warmer sunlight over every table.** Billar, Póquer, Dominó, Ludo, Caída and
  Bolas Criollas share one golden late-morning light and sky, and the pool
  table has bright green cloth and honey wood.

- **Choose how sharp Pintura's bots shoot.** The host picks Fácil to Experto in
  the lobby: easy bots spray and pause, expert bots rarely miss.

- **Pintura looks like a paint battle.** The plaza court has warm stone
  paving, crates and ground splattered from earlier games, bunting on wooden
  posts, and every hit leaves a glossy splat with drips.

- **The plaza feels alive around every table and court.** A pack of karts
  from Derrape races past in front of the houses, panas stroll along the edges
  and guacamayas circle overhead while you play Billar, Dominó, Póquer, Ludo,
  Caída or Bolas Criollas.

- **Throw Bolas Criollas from behind your pana, on a court in the plaza.**
  The court now sits in Plaza Pana under papel picado, with benches, coolers,
  planters and a chalk scoreboard; the host can move it to Puerto Coco, Hato del
  Sol or Ruinas del Mango. Pick Fácil to see where every ball ends up, or
  Experto for rival bots that knock your ball away. A camera button switches to
  a straight-down view. Bululú's criollas minigame moved to the beach court.
  Or play at Estadio Pana, in front of a cheering grandstand while the Derrape
  race roars down the straight.

- **Race to real recorded songs in Derrape and Curiara, with a separate Música slider.**
  Every circuit has its own song (joropo in Los Llanos, gaita in the plaza, calipso
  in Chi Chi…), plus garage, battle and results music and a finish fanfare. The
  music speeds up on the final lap and dulls while you spin out.

- **See interaction progress while reviving panas and turning Reliquia's wheels.**
  The game now attaches the shared progress ring's mesh correctly.

- **Start a new game already in 3D with `.\dev.ps1 new-game <id> -Kind table|live`.**
  The scaffold creates a playable plaza table or a real-time plaza game with your
  pana, shared rooms, rules tests and a two-client browser suite that pass from
  the first run. Contributors: AGENTS.md now says every game is 3D.

- **Ludo sits at a real table in the plaza instead of looking straight down at a flat board.**
  It shares Billar's and Póquer's 3D stage (sky, fountain, framed camera); the top
  view is still a button away.

- **Browse aligned launcher pages and see your pana preparing before the editor opens.**
  Shared page widths keep the header and content edges together. The character
  editor shows loading until its model and graphics are ready, with retry on failure.

- **Bolas Criollas and Ludo now have illustrated launcher cards and backgrounds.**
  Each game uses two supplied capybara illustrations, with smaller card files
  for quick browsing and large artwork for the featured game.
  Ludo also prepares its table behind the shared illustrated ready lobby.

- **Prepare games in illustrated lobbies with saved pana portraits and shared readiness.**
  Browse real settings while scenes and shaders prepare, wait for friends before
  starting, and retry failed loading. Curiara shows boat seating; Derrape follows
  Copa, Taller and Parrilla, with a garage that waits for its previews to finish.
  Navigation uses compact chevrons and avatar stills are reused across menus.

- **Play Ludo in 3D with up to four panas or fill the table with bots.**
  Roll the dice, capture rival pieces and race all four home with saved avatars,
  shared invitations, touch and keyboard controls, host recovery and local play.

- **Choose games from an illustrated launcher with category filters and a thumbnail rail.**
  Browse descriptions, create an invite link or enter a room code on desktop and
  phones. Hosting integrations can handle party launches and show member portraits;
  the avatar editor loads only when opened. ¡Pintura! is now Pepazo, with existing
  links preserved; all other game names stay the same.

- **Choose your partners and seating in Caída, Dominó and Poker without leaving the room.**
  Hosts can swap seats in the lobby and return to setup after a round. Changing
  Caída or Dominó teams starts a fresh score; Poker keeps each player's chips.

- **Play Bolas Criollas on a shared 3D court, as a full game or a Bululú minigame.**
  Invite up to four panas for red-versus-green matches with bots, eight balls per
  team, arrimes, ground boches and 12- or 24-point house rules. Bululú adds a quick
  two-throws-each contest. Both use saved panas, rolling collisions and a visible
  aiming guide; the court and balls are also available in Pana Studio.

- **Derrape's grass and trees gain procedural surface detail that follows graphics quality.**
  Seeded ground patches, visible 3D grass tufts, leaf mottling and bark grain
  enrich the circuits and their Studio previews. Rápida keeps simple surfaces;
  Equilibrada adds sparse tufts and Nítida fills out nearby grass, fading with distance.

- **Caída lets each dealer cut the deck and choose 1 or 4 before every reparto.**
  The choice now happens at the table, with the previous reparto's score nearby.
  Patrulla and the other cantos explain themselves beside your hand, and Últimas
  announces the final hand and its no-clean-table-bonus rule.

- **Race a much larger Puerto through La Guaira's terminal, hillside town and San Carlos.**
  One adventure lap targets a 3–4 minute race, shown in the track picker and
  start screen. Drive a submerged tunnel with sea windows beneath the original
  silos, through three cranes and stacked cargo walls, up the mud climb and
  around widened, guarded castle terraces before jumping onto the descent.
  Connected town blocks have shops, courtyards and houses facing their streets.
  Casa Guipuzcoana, the silos and San Carlos retain the supplied prototypes'
  geometry and textures and are reusable in Pana Studio.

- **Choose Casa Guipuzcoana or Fuerte San Carlos for Caída, Dominó and Póquer.**
  Hosts select the setting in the lobby; everyone shares it through late joins,
  host changes and practice, while each game keeps its own table and rules.

- **Pana Studio can generate and customize Venezuelan-inspired colonial houses.**
  Generate collections of 50 houses from six families, six window designs,
  three roof shapes and three facade layouts, with balconies, porches and plants.
  Four wall finishes add soft plaster shading and small painted or exposed-brick
  patches, with their own seeded variation and lock.
  Edit each house, lock choices while rerolling, save or load JSON collections,
  and preview ten houses on Calle de las flores.

- **Derrape adds eleven scenery models to its towns, coasts and countryside.**
  Cafés, fountains, market carts, fishing structures, port equipment and other
  landmarks now appear across six circuits and are available in Pana Studio.
- **Escondidas reshuffles its objects every round and gives you more time to hide.**
  All four maps get fresh prop positions and orientations shared by everyone in
  the room. Hiding now lasts 30 seconds by default; hosts can choose 15, 20, 30,
  45 or 60 seconds in the lobby, including local practice.
- **Choose three new shared maps for Escondidas, Paintball, Billar and Caída.**
  Puerto Coco, Hato del Sol and Ruinas del Mango bring distinct hiding routes,
  paintball cover and scenery. Hosts preview and choose the map in the lobby;
  table games use a clear central courtyard, and friends joining later see
  the same setting. The original plaza and paintball court remain available.
- **Derrape brings five new scenery models from the circuit artwork into the races.**
  Plaza Pana gains an open music pavilion and a boat-repair yard; Salinas gains
  salt-harvesting machinery and flamingos along its pink ponds. El Estadio has
  detailed tire workshops, and Isla Bululú has its own boat yard. All five are
  available in Studio; optional bird colonies follow the shared quality setting.
- **Derrape adds assisted drifting, car specialties, safer recoveries and clearer item counterplay.**
  Aguacero advances toward the leader in timed waves; the faster chancleta
  pursues distant leaders. Car contacts stay grounded, and starts, rescues and
  repeated impacts grant brief ghost protection. Drift, slipstream, jump and
  surface talents make car and tire combinations matter. Gentler drift steering,
  predictive edge help and stable turbo exits make corners easier to learn;
  a release cue shows when a turbo is ready. Road wear and sector
  pennants add circuit detail; shared quality settings now also reduce shadows,
  weather and optional scenery without changing handling or pose frequency.
- **Play paintball and Texas Hold’em with your panas, or practice against bots.**
  ¡Pintura! brings a 3D arena for up to eight players with cover, reloads,
  respawns and two-minute rounds. Póquer seats up to six with private cards,
  free chips, no-limit betting, side pots and showdowns. Both use your saved
  pana, shared invitations and menus, touch controls and local bot practice.
- **Billar brings eight-ball pool to Pana for two friends or solo practice.**
  Aim with mouse, touch or keyboard, choose shot power and pocket your group
  before the eight. Shared rooms keep turns, fouls, ball in hand and rematches
  in sync, including an unfinished shot when the host leaves.
- **Bululú lets up to four panas play the board and minigames together online.**
  Share a room invitation, take your own turns and control your own pana;
  bots fill empty spots, and local practice remains available. If the host
  leaves, another player continues from the current turn or minigame checkpoint.
- **Derrape guides you from your panas to the starting grid in four illustrated steps.**
  Choose solo, split screen or online, customize your real car, browse twelve
  illustrated circuits and three cups, then race. Layered festival artwork adds
  gentle pointer parallax; circuit art accompanies real loading progress, with
  reduced-motion support and a start button that stays visible on phones.
  Returning to the first step in an online room keeps its message above the navigation.
  Earned trophies and older-edition badges remain visible on cup choices after reloading.
- **Water shaders, living weather, and tactile game feel across Pana.**
  Water surfaces and waterfalls add multi-wave displacement, dual caustics, crest foam, counter-scrolling ripples, and wave-synced boat buoyancy; tracks and islands add wind-swaying trees, angled rain with splashes, lightning and thunder, drifting snow, and post-shower rainbows; buttons, dashes, explosions, coin pickups, hold-to-charge triggers, and supply chests gain squash-and-stretch, shockwave rings, scorch decals, magnetic pull-in, flying HUD counters with combo badges, and rarity light and audio.
- **Derrape adds Copa del Agua and four independently playable circuits.**
  Race salt ponds, delta villages, river caves and the Tepuy waterfall in a
  four-stage championship; Studio previews use the same track constructors.
- **Salinas gives racers a dry line beside its shallow-water crossing.**
  Road geometry, tire grip and visible water agree; repeated cups release
  their signs and flag textures, portrait touch controls fit small phones,
  the portrait podium stays above the standings, and full rooms report their
  capacity correctly.
- **Grand Prix keeps each pana's complete appearance through the championship.**
  Paint, horn and flame choices follow the frozen entrant, and podium portraits
  show the actual racers. Bululú shares the waterfall effect and Galope adds a
  shelter to its existing lagoon landing.
- **Derrape draws full racing grids with fewer calls while preserving the cars.**
  Rigid parts share draw batches with their original colors; drivers, wheel
  steering, suspension, flags and breakaway pieces keep their animations, while
  the body paint retains its customization material. The water circuits also
  group their unchanged vegetation into fewer draw batches.
- **Derrape keeps your online Grand Prix together across four races.**
  Copa Pana and Copa Aventura carry the same rivals, official standings and
  one-time rewards through map changes, with synchronized loading and reload recovery.
- **New game: Curiara, race dugout canoes down the Amazonas.**
  Paddle with A and D in rhythm (no throttle): alternate to go straight,
  stroke the same side twice to turn and hit the gold sweet spot for a
  ¡Remazo!. Read the chorro through a jungle caño (or gamble on the igapó
  cut), pick a lane down the raudales under the Autana tepui and cross the
  Río Negro past toninas, caimanes and a remolino to the churuata. Hits,
  bad drops and bumps fill the tip meter until you capsize; Space throws a
  ¡Salpicón! at the canoe beside you. Up to 8 panas online, bots fill in.
- **Curiara has Parejas: two panas share one canoe.** The proa paddles,
  the popa holds the rudder, back-paddles and throws the salpicón, and a
  tap right with the stroke calls ¡Ahora! for 15% more.
- **Bululú has three river minigames: ¡Remada!, ¡Raudal! and ¡Remolino!.**
  Sprint 120 m in rhythm, dodge rocks and jump ledges down four rapids for
  mangos, or paddle away from a growing whirlpool and shove the others in.
- **Bululú has ¡Chinazo!, a slingshot minigame against the iguanas in the mango tree.**
  Aim with the mouse (or WASD, or drag a finger), pull the china and let
  go: stones take a moment to land, so lead the runners. Three mamones a
  load, a golden iguana worth 3, a guacamaya that costs 2 and a ¡Plaga!
  for the last 10 seconds.
- **Iguanas sun themselves around Pana's maps.** Look for them on
  Bululú's beach rocks and lighthouse, Pana Gas in the Desierto, limbs over
  Curiara's caño, Galope's fence posts and the plaza church's wall.
- **Contributors have a phased roadmap for Derrape Grand Prix and four new water maps.**
  Plan 56 specifies three four-race cups, online championship continuity,
  shared scenery and verification across 22 implementation phases.
- **New game: ¡Embuste!, find the mummy among your panas at the camp.**
  Do chores until dawn while one or two secret mummies wrap panas, slip
  through hollow logs, pose as barrels and sabotage the camp. Report the
  statues, argue at the fogata and vote someone down the river. Each pana
  plays on their own screen; practice with bots in the browser.
- **Bululú has an ¡Embuste! minigame.** One of the four panas is secretly
  a mummy faking the chores; watch for sand, then vote it out.
- **Play Derrape with a controller or with a pana on the same screen.**
  Gamepads drive and fire items, two players can race in split screen,
  and the HUD warns about wrong-way driving and incoming items, shows
  your best lap and lets you look behind with C.
- **Derrape has a taller to spend your coins.** Every race pays into a
  wallet you keep; paint your car, swap the horn or change the turbo
  flame. Cup trophies show in the garage and unlock mirror mode, gold
  paint and a rainbow flame.
- **Derrape's tracks fight back.** Fall off or get stuck and a zamuro
  carries you back (or press R), take plank shortcuts on three tracks,
  dodge cows, a bus and rolling boulders, race to a Venezuelan groove
  per track, and pack rain cauchos for wet Selva and Páramo.
- **Derrape has cups, balloon battles and race options.** Win the Copa
  Mango or Copa Arepa across four tracks for a gold, silver or bronze
  trophy, pop rivals' balloons in Globos, and pick easy, normal or hard
  rivals, 1 to 5 laps and mirror mode before you start.
- **Derrape has six new items.** A cohete that chases the car ahead, the
  chancleta that drops on the leader, a totuma shield, exploding trap
  crates, an aguacero that soaks everyone ahead and a jarra with three
  turbos. Ten coins power up whatever you use next.
- **Derrape has real drifting.** Hold Shift (or the Derrape button) in a
  bend: sparks go blue, orange and purple, and letting go fires a turbo.
  Time the gas on the countdown for a rocket start, do tricks off ramps,
  ride a rival's slipstream, and watch your coins: hits knock them off.
- **Bululú has a new card minigame, ¡Caída!** Cards flip onto the table; slam
  first when one matches the number before it, but a wrong slam costs a point.
  Minigames now come up shuffled instead of always in the same order.
- **¡Un, dos, tres, momia! joins Bululú.** Run for the relic while the temple
  mummy counts and freeze when she turns; hide as a barrel to sneak closer.
- **¡Coleo! comes to Bululú.** Chase bulls down the manga on horseback, get
  right behind one and pull its tail to tumble it; most bulls wins.
- **¡Choque de carritos! brings the Derrape karts to Bululú.** Bump the others
  off a platform over the sea while its edge falls away. On phones, minigames
  that move in every direction show a d-pad.

### Changed

- **Lancha and Chapita have their own launcher art.** Lancha's tile shows
  the race jumping the Raudales de Atures, and Chapita's in-game picture
  is replaced by a batter launching the flag-painted chapita.

- **Online, your own pana moves the moment you press a key.** In Pana
  Cocina, Reliquia, Escondidas, Galope and Lancha a guest no longer waits for
  the host to see the key before their pana, horse or lancha moves; the host
  still has the last word, so everyone ends up in the same place.

- **Derrape and Bululú start with half the download.** Derrape fetches
  only the map you pick and Bululú only the minigame being played, and the
  music is about a third smaller.

- **Games run smoother on phones.** A phone now starts on *Equilibrada*
  instead of *Nítida*, shadow detail follows the quality you pick, and
  when a game can't keep up it draws fewer pixels by itself until you
  choose a quality again.

- **Derrape keeps up on slower phones.** The HUD, minimap and camera
  update once per frame instead of once per physics step, so a slow frame
  no longer makes the next one slower.

- **You can always find your own pana in a Bululú minigame.** A ring in
  your colour at your feet and a chevron over your head mark you, even
  when friends wear the same outfit.

- **¡Atrapa los mangos! and ¡Embuste! got real places to play.** The mango
  yard has a proper mango tree, crates of the day's pick and bunting; the
  Embuste camp is now a dig site with ruins round the relic, braziers,
  tents, supplies and a lookout tower.

- **Bululú shows how far the mango cart is.** Your turn and the dice
  prompt say how many tiles away the cart is, and at the fork each route
  says how many tiles it takes to reach it.

- **Everyone says ¡Listo! before an online Bululú minigame.** Each pana
  gets their own button and sees who is ready; it starts when all are,
  or after 15 seconds. Before, only the host was asked.

- **Bululú's minigames tell you what to do right now.** A line under the
  cards shows your secret role and the vote in ¡Embuste!, run or freeze
  and your disguises left in ¡Momia!, when to grab the tail in ¡Coleo!,
  the collapse warning and turbo in ¡Choque!, the log about to reverse in
  ¡No te caigas!, your splash cooldown in ¡Remolino! and the rock or ledge
  ahead in ¡Raudal! (where your channel is tinted in your colour). In
  ¡Embuste! a mummy
  who never cranks now gets caught: bots notice whose lantern never
  lights, while a careful, unhurried crank hardly spills any sand.

- **¡Remada! keeps your canoe in the picture.** The camera no longer
  races off with the leaders and leaves you behind. A ring on the water
  around your canoe shows your rhythm: it turns green in the ¡Remazo!
  window and coral when you mash. A strip at the bottom shows how far
  down the caño everyone is, and in every minigame the six score cards
  sit in one row so the timer never covers one.

- **Bululú's minigames fit a phone.** In landscape the six score cards
  shrink to one slim strip at the top and the menu moves to the corner, so
  the field is clear; your card says TÚ. Touch buttons match each minigame
  (no jump button where nothing jumps; ¡Dale!, Turbo, Jalar and friends
  where there is an action). Held upright, Bululú asks for landscape, and
  if you keep playing that way the camera widens so every pana stays in
  view; Chinazo plays letterboxed so aiming matches everyone else's.

- **QQSMP has three Tema packs.** Venezuela gains Historia de Venezuela
  and Naturaleza venezolana; Cultura general brings Ciencia, Geografía,
  Historia universal, Deportes, Animales and Arte y entretenimiento; De
  todo mixes them all. The host picks one in the room options.


- **Play Billar, Póquer and ¡Pintura! inside Pana's 3D plaza.**
  Pool has a physical table, balls, cue and perspective aiming. Poker deals
  cards onto the felt beside real chip stacks and seated panas. Paintball
  follows your pana through a court built with shared town assets, with camera
  orbit, touch controls and an optional overview. Fullscreen worlds replace
  the inset tables; the new equipment is available in Pana Studio.

- **Derrape's championships are now Copa Pana and Copa Aventura.** Each has a
  new four-track order; Mango and Arepa trophies, coins and cosmetics stay
  earned, with old route wins labeled "Edición anterior" instead of counting as
  wins on the new routes.
- **Derrape Grand Prix now keeps the same eight racers for all four rounds.**
  Rival looks and cars stay fixed, each track has its own lap preset, later grids
  follow championship position, and local split screen and mirror work throughout.
- **Grand Prix garage previews, standings and podiums show the full cup story.**
  Selecting a cup lists all four circuits with lap presets and estimated duration;
  results show stage points, rank changes, tiebreaks, a 12-second next-track
  intermission, a championship podium and one-time coin receipts.
- **Contributors have one shared Grand Prix championship rulebook.** The pure
  renderer-free rules cover stable entrants, seeded grids, stage result ledgers,
  points, DNF/DNS/retirement and championship tiebreaks for local and online play.

### Fixed

- **An idle player can't stall an online Bululú game.** A board choice
  nobody answers is taken automatically after 30 seconds, and a host
  change no longer reshuffles the minigames, so none repeats early.

- **Bululú's ¡Caída! no longer favours the first seats.** When several
  panas slap in the same instant, a fair draw picks who takes the cards
  instead of the seat order; a wrong slap now says −1.
- **In ¡Atrapa los mangos! the closest basket gets the mango.** Two
  overlapping baskets used to hand it to whoever sat first.

- **End-of-round cards fit on phones again.** The shared results card and
  other kit modals counted their padding outside their width and spilled
  past the right edge of narrow screens.

- **A host whose tab is in the background no longer slows the game for everyone.**
  Cocina, Reliquia and Escondidas now step the game by real elapsed time, so a
  minimised host keeps the round at full speed.

- **The menu and invite buttons stay put while you play.**
  The shared lobby no longer re-inserts them on every HUD update, which could
  swallow clicks and drop keyboard focus.

- **Four-seat tables turn a fifth pana away instead of seating them where they can't play.**
  Every room now takes its size from the game, so Caída, Dominó and Ludo stop at four,
  and a full Póquer table gives a bot's chair to the arriving pana between hands.

- **One bad message can no longer end every game on the server.**
  A room that hits an error skips that message and keeps playing; the old `/ws`
  relay is gone and Derrape no longer answers every clock ping twice.

- **Bululú's dice show the numbers you rolled instead of always showing two fours.**
  The result faces turn toward the camera when the dice stop, and online guests
  see the correct faces even when consecutive rolls repeat.

## 0.1.0 - 2026-10-16

### Added

- **Race Derrape online with up to 8 panas.** Open a room from the garage or a
  shared link; each pana drives their own car, bots fill the grid, and the room
  keeps the order, finish times and results in sync.
- **Every game ends on the same results card.** Standings, scores and the
  "again" button sit in the same place in every game, and long names wrap instead
  of breaking the layout.
- **Crowns, coins, mangos and hearts are drawn icons.** Phones no longer swap them
  for their own emoji, so Derrape's items, Bululú's winners and Reliquia's health
  look the same everywhere.

### Changed

- **Online play runs on Colyseus rooms.** Rooms choose the host, hand it over at
  once when the host leaves, and give a dropped pana 20 seconds to come back to
  the same seat.
- **Invite links carry only the room.** A shared link no longer passes on your
  name, debug switches or the party lead role.
- **Bululú is listed as a solo game.** The hub no longer offers "Crear sala" or
  room links for it.
- **Rules buttons in Caída and Dominó lose their arrow,** since they open a
  dialog rather than another page.

### Fixed

- **"Crear sala" no longer copies a dead link** for single-player games.

**Every merge to `main` is now a release.** The changelog's Unreleased notes become
the GitHub release notes, under a version tag.

For contributors: `npm test` runs every unit test plus `Pana/tests/conventions.test.js`,
`npm run test:browser` runs the Playwright suites, `.\dev.ps1 check` runs both
locally and CI runs the checks on every push to `dev`. `AGENTS.md` now holds only
the rules; per-area notes live in `docs/knowledge/`.

## Before the changelog

The games as they first arrived (dates from the git history).

### Caída (2026-10-15)

A 3D Spanish-card table in Plaza Pana. Reach 24 points with caídas, clean tables,
opening calls and optional classic cantos. Play solo with bots or share a private
room for two, three or four players, including partnerships. Includes capture
previews, touch/keyboard controls, shared Pana characters, card counting, replay,
offline fallback and host migration. The table's exact rule variant is explained
in the controls menu. Spanish cards and score tokens are also available in Pana
Studio.

### Dominó (2026-10-15)

A 3D domino table in Plaza Pana, with your actual saved characters seated around
it, wooden chairs, coffee and animated physical tiles. Play four-seat partnership
dominoes to 100, solo with bots or with up to four human players. Includes
both-end placement, legal passes, blocked-round scoring, touch/keyboard controls,
a table camera, shared invitations and host migration. Additional visitors watch
until a seat opens. The table, chair and domino tile are also available in Pana
Studio.

### Reliquia (2026-10-15)

A cooperative expedition into an abandoned mine and the temple beneath it.
Explore with your saved pana, fight wrapped guardians, activate two timed winches,
retrieve the sun relic and return to camp together. Includes dodging, healing,
revives, adaptive encounter pacing, touch controls, late joining, host migration
and replay. Play solo or share a room with up to 8 panas; the first expedition is
designed around small groups.

### Galope (2026-10-15)

Horse racing around a 482-metre Llanos ranch circuit. Ride your saved pana
through two shallow esteros, jump three logs per lap and manage stamina over two
laps. Choose a horse coat, race against the hato's jinetes or invite up to 8
panas. Includes touch controls, shared settings, ordered checkpoints, results,
replay and host migration. The surrounding hato opens onto an irregular lagoon
with an island and a winding morichal channel, with caneyes, chinchorros, a canoe
landing and native grassland. Thirteen new reusable models are also available in
Pana Studio.

### Pana Cocina (2026-10-14)

A cooperative three-minute cooking rush in Plaza Pana. Collect ingredients,
prepare arepas, cachapas, tequeños and empanadas, mind the stoves, and serve
before orders expire. Play with two bot helpers or invite up to 8 panas. Includes
touch controls, shared counters, fire recovery, team scores and replay. Panas
have animated legs, and the kitchen crew wears chef hats and aprons over their
saved outfits.

### Escondidas · Pana Hunt (2026-10-14)

Hide in a colourful market plaza as a barrel, crate, cooler, plant or bench.
Three transformations per round; 15 seconds to hide, then 100 seconds to hunt.
Play solo with bots or share a room with up to 8 panas. Roles rotate, with four
rounds for a small group and up to eight for a full room. Uses the same saved
character, Bululú foliage, and market props also featured in Derrape's Los
Llanos track.

### Bululú (2026-10-14)

A party board game on Mango Island. Roll the dice, collect monedas, buy the
*Mango de oro*, and win a minigame after every round.

### Derrape (2026-10-14)

A goofy toy-car race. Jump ramps, flip over, lose your bumpers, honk *La
Cucaracha*. Your pana (made in the hub) is the driver. Choose from eight
circuits, including Plaza Pana and Isla Bululú. Collect coins for up to 8% extra
speed, smash wooden supply crates and carry two items. Throw forward with
**Space**, backward with **X**, and switch with **Q** or **1/2**. Keep a mango
equipped to block an incoming mango; each block spends one mango. The garage
previews all eight detailed cars and five swappable wheels (cauchos), and touch
controls are available on phones. The plaza buildings, island terrain, trees and
scenery use the same shared sources as the other games, so asset improvements
carry through everywhere.
