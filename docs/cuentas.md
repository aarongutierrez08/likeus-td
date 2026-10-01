# Activar las cuentas en producción

Las cuentas (ADR 018) funcionan sin estos pasos, pero sin volumen la base se pierde en cada reinicio y sin credenciales solo se juega como invitado.

1. **Volumen en Fly** (una vez, antes del próximo `fly deploy`): `fly volumes create accounts --region gru --size 1`. `fly.toml` ya lo monta en `/data` y apunta `ACCOUNTS_DB`, `PUBLIC_URL` y `CLIENT_ORIGINS` a producción. Con el volumen, la máquina no puede escalar a más de una.
2. **Discord**: en https://discord.com/developers/applications crear una aplicación, en OAuth2 agregar el redirect `https://likeus-td.fly.dev/auth/discord/callback`, y cargar `fly secrets set DISCORD_CLIENT_ID=... DISCORD_CLIENT_SECRET=...`.
3. **Google**: en Google Cloud Console crear un cliente OAuth "Aplicación web" con el redirect `https://likeus-td.fly.dev/auth/google/callback`, y cargar `fly secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`.

Nunca poner `AUTH_FAKE=1` en producción: cualquiera entraría como cualquiera. En desarrollo, `AUTH_FAKE=1 pnpm dev` muestra el botón "Prueba".
