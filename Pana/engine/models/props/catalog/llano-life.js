// Native factories shared by the Galope world and Studio's individual previews.
const entry=(id,name,factory,description,previewOptions=null,also=[])=>({
  id,name,category:'Vida llanera',source:'/engine/models/props/llano-life.js',factory,
  usedBy:['Galope',...also],previewOptions,description,tags:['llanos','hato','paisaje'],pack:'llano-life',
});
export default [
  entry('ranch-caney','Caney de palma','ranchCaney','Refugio abierto con techo de palma en capas y estructura de madera.'),
  entry('chinchorro','Chinchorro del hato','chinchorro','Tejido de colores entre dos postes, con cuerdas y movimiento suave.'),
  entry('saddle-stand','Montura en caballete','saddleStand','Silla de cuero, manta, estribos y soga sobre un soporte de madera.'),
  entry('hitching-rail','Palenque de caballos','hitchingRail','Travesaño con amarre, soga enrollada y balde.',{span:4}),
  entry('campfire','Fogón de campamento','campfire','Leños y piedras con brasas animadas a tiempo absoluto.',null,['¡Embuste!']),
  entry('coffee-table','Mesa de café del hato','coffeeTable','Mesa con bancos, termo y pocillos.',null,['¡Embuste!']),
  entry('river-canoe','Curiara del estero','riverCanoe','Canoa abierta con asientos, canalete y amarre; origen en la quilla.',null,['¡Embuste!']),
  entry('wetland-landing','Embarcadero del estero','wetlandLanding','Pasarela de tablas con pilotes y baranda de soga.',{length:7},['¡Embuste!']),
  entry('flooded-fence','Cerca inundada','floodedFence','Postes torcidos, cuerdas vencidas y un travesaño roto.',{span:8,seed:7}),
  entry('llano-trail-sign','Señal de sendero llanero','trailSign','Cartel de madera con texto configurable.'),
  entry('termite-mound','Termitero de sabana','termiteMound','Montículo de tierra con torres erosionadas.',{seed:7}),
];
