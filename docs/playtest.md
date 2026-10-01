# Playtest con amigos

Guía para la sesión de juego del punto 15 del diseño. Los bots miden números; esto mide lo que los bots no ven: si se entiende, si hay decisiones y si es divertido. Una sesión son tres partidas de unos 20 minutos.

## Antes
- Desplegar la versión a probar y anotar `BALANCE_VERSION` y el commit.
- Sala privada, 3 a 5 jugadores, mapa `s` en la primera partida, otro mapa en la tercera.
- Nadie lee nada antes: el pilar 1 dice que se entiende en 5 segundos.
- Dejar abierto "Reportar problema": cada reporte trae la partida para reproducirla con `pnpm report`.

## Qué mirar mientras juegan (anotar, no ayudar)
- **Legible (pilar 1).** ¿Alguien pregunta qué hace una torre, una habilidad o una doctrina? ¿Leen el calendario antes de comprar? ¿Entienden por qué una torre pega poco contra una armadura?
- **Decisión por oleada (pilar 2).** ¿Cambian lo que compran según el calendario, o repiten siempre lo mismo? ¿La oleada 5 (Camiones), la 10 (Patrón) y la 11 (Colados) los obligan a pensar?
- **Sinergia (pilar 3).** ¿Se juntan torres para las auras? ¿El mercado (↑ en la tienda) los hace variar?
- **Nunca quieto (pilar 5).** ¿Usan las habilidades durante la oleada o se olvidan? ¿El anfitrión llama oleadas antes?
- **Roles (pilar 6).** ¿Alguien hace de economista (Alcancía, regalos) y otro de defensor? ¿Hubo reproches?
- **Mazo.** ¿Cuánto tardan en armarlo? ¿El aviso de armaduras sin cubrir los hace cambiar algo?
- **Doctrinas.** ¿Les alcanza el tiempo entre oleadas para elegir? ¿Usan el cambio de oferta?
- **Desvíos.** ¿El anfitrión los abre? ¿Antes de abrir mira dónde están las torres?
- **Ritmo.** ¿En qué oleada se aburren? ¿En cuál se estresan?

## Después (5 minutos, una pregunta por persona)
1. ¿Qué decisión te costó más?
2. ¿Qué no entendiste?
3. ¿Qué querías hacer y no pudiste?
4. ¿Jugarías otra?

## Qué hacer con lo anotado
- Lo que no se entendió va como bug de legibilidad (pilar 1), antes que cualquier número.
- Lo que nadie usó (torre, habilidad, doctrina) se cruza con `/balance`: si los bots tampoco la compran, es número; si los bots sí, es legibilidad.
- Una línea por sesión en el "Diario de sensaciones" de `docs/diseno.md`.
