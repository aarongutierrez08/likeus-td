# ADR 019 — Varias formas de entrar por cuenta, unión de cuentas y vinculación confirmada por el navegador

Estado: aceptado
Fecha: 2026-10-02
Extiende al 018.

## Contexto
Con el 018, una cuenta tenía un solo proveedor: quien creaba Discord y Google con el mismo mail terminaba con dos cuentas del juego y su progreso partido, sin forma de juntarlo. Unir por mail es inseguro: un proveedor puede aceptar un mail sin verificar y abriría la cuenta de otro.

## Decisión
- Una cuenta guarda sus formas de entrar en `identities` (proveedor + id del proveedor). Desde una sesión abierta, loguearse con otro proveedor lo suma; entrar con cualquiera abre la misma cuenta. Una sola forma de entrar por proveedor.
- Si esa identidad ya era de otra cuenta, las dos se unen: un invitado se mueve a la cuenta; si la sesión ya era una cuenta, la otra se mueve a ella. Partidas, sesiones y formas de entrar pasan enteras; la experiencia de cada día respeta el tope diario.
- Nunca se une por mail. Ni siquiera se pide el mail.
- La vuelta del proveedor no vincula: deja la identidad pendiente por un minuto y manda al navegador de vuelta con un código. El cliente lo canjea (`POST /auth/claim`) con su propia sesión, y solo vale si es la misma sesión que empezó el login. Así un link de login armado con la sesión de otro no mueve la cuenta de quien lo abre a la de quien lo armó.
- Las bases con un proveedor por cuenta se migran solas al abrir.

## Consecuencias
+ Un jugador tiene un solo progreso aunque use Discord en una compu y Google en otra.
+ Juntar dos cuentas requiere probar ser dueño de las dos en el mismo navegador y en el momento.
- Una unión no se deshace.
- Volver de un proveedor cuesta un pedido más antes de ver el perfil.
