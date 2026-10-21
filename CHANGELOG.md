# Changelog

What changed in Pana, for the people who play it. Newest first. Every change
that players, hosts or contributors will notice adds a line under
`## Unreleased` in the same commit (see `AGENTS.md`). Each merge to `main` releases:
the release workflow stamps Unreleased with the version and date, and that section
becomes the GitHub release's notes.

## Unreleased

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

## 0.4.0 - 2026-10-19

Maintenance release: no changes you will notice.

## 0.3.1 - 2026-10-18

Maintenance release: no changes you will notice.

## 0.3.0 - 2026-10-18

Maintenance release: no changes you will notice.

## 0.2.0 - 2026-10-17

### Added

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
