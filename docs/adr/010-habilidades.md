# ADR 010 — Habilidades: carta como datos, lanzada por comando

Estado: aceptado
Fecha: 2026-09-30
Extiende al 008.

## Contexto
El diseño suma un segundo tipo de carta: acciones activas con enfriamiento que el jugador tira durante la oleada (bombardeo, escarcha, sobrecarga, reparación), mejorables con oro. Tienen que entrar en el lockstep como todo lo demás, dejarse agregar sin tocar siete archivos y respetar que cada nivel cambie una sola cosa.

## Decisión
Una habilidad es una entrada en `packages/sim/src/balance/abilities.ts`: a qué apunta (`cell`, `path`, `ownTower`, `none`), costo de mejora, un nivel base y un parche por nivel. `defineAbilities` normaliza cada nivel a un objeto completo y rechaza el parche que toca el enfriamiento y el efecto a la vez.

Se usa con el comando `useAbility` y se mejora con `upgradeAbility`. La sim valida y deja el efecto en el estado: bombardeos marcados (`blasts`), tramos helados (`frostZones`), torres sobrecargadas (`overchargeUntil`) o vidas. El sistema `abilitiesAct` los resuelve antes de que los enemigos se muevan. Toda habilidad es carta de su dueño: la mejora, la usa y la espera solo él, aunque su efecto ayude al equipo (Reparación suma la vida al equipo).

Reglas que siguen a las torres: el bombardeo es daño de área, así que pega a invisibles no revelados y respeta escudo, armadura y marcas. Un tramo helado no escribe sobre el enemigo: la velocidad toma el freno más fuerte entre el propio y el del tramo, y el freno de una Heladera sobrevive al tramo. Una sobrecarga nueva nunca acorta una en curso. Una muerte por habilidad paga el botín como siempre, pero no suma muertes a ninguna torre ni paga auras de oro.

Hasta que exista el mazo (punto 10 del diseño), todos los jugadores tienen las cuatro.

## Consecuencias
+ Agregar una habilidad es una entrada de datos y, si su efecto es nuevo, un `case` en `castAbility`.
+ El server solo valida la forma del comando; la regla la valida la sim, igual que con torres.
+ El daño de habilidades se cuenta aparte (`damageByAbility`), así `/balance` puede medir la regla de que una habilidad no reemplaza a una torre.
- El efecto de cada habilidad es código, no dato: a diferencia de las familias de torres, cuatro habilidades no justifican un lenguaje de efectos.
- El bot no usa habilidades todavía: el simtest mide torres solas.

## Alternativas descartadas
- Habilidades como torres invisibles con vida corta: mezcla cartas con entidades del mapa y ensucia tienda, venta y estadísticas.
- Efectos declarativos componibles: más de lo que pide un set de cuatro; se revisa si una temporada trae habilidades que los necesiten.
