# ADR 004 — HUD en DOM (Solid), mapa en PixiJS

Estado: aceptado
Fecha: 2026-09-26

## Contexto
El juego necesita menús, tienda, chat, lobby y HUD, además del mapa con cientos de sprites. Tiene que funcionar en móvil y en notebooks viejas.

## Decisión
Solo el mapa y las entidades se dibujan en canvas con PixiJS. Todo lo demás es HTML con Solid.

## Consecuencias
+ UI accesible, responsive, rápida de iterar con hot reload.
+ PixiJS batchea sprites y usa la GPU; el mapa rinde con cientos de entidades.
- Dos sistemas de coordenadas (DOM y canvas); los tooltips sobre entidades necesitan traducción.

## Alternativas descartadas
- Todo en canvas: UI inaccesible, texto borroso en móvil, cada botón hecho a mano.
- Phaser/engine completo: trae escena, físicas y loop que no necesitamos; la sim ya es nuestra.
