---
paths:
  - "packages/server/**"
---
# Reglas de packages/server

- Una sala Colyseus por partida. Código de sala de 4 letras. Salas públicas listadas, privadas solo por código.
- El server corre la misma sim que el cliente. Cada comando se valida contra el estado del server antes de reenviarlo.
- Modelo lockstep: el server ordena comandos por tick y los difunde; solo envía estado completo al unirse o reconectar.
- Si el hash de estado de un cliente difiere del server, se le manda snapshot y se registra el desync.
- Rate limit por jugador. Ningún comando del cliente se ejecuta sin validar.
- Nada de lógica de juego acá: si hace falta una regla, va en sim.
