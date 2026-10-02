import { randomBytes } from "node:crypto";

/** Who the provider says the player is: a stable id and a display name. */
export interface ProviderIdentity {
  id: string;
  name: string;
}

export interface Provider {
  /** Where to send the browser to log in. */
  authorizeUrl(state: string, redirectUri: string): string;
  /** Trades the code the provider sent back for the player's identity. */
  identify(code: string, redirectUri: string): Promise<ProviderIdentity>;
}

/** A provider field as text: ids come as strings or numbers, names as strings; anything else falls back. */
function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function oauth(cfg: {
  authorize: string;
  token: string;
  userinfo: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  read: (user: Record<string, unknown>) => ProviderIdentity;
}): Provider {
  return {
    authorizeUrl(state, redirectUri) {
      const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri, response_type: "code", scope: cfg.scope, state });
      return `${cfg.authorize}?${q.toString()}`;
    },
    async identify(code, redirectUri) {
      const body = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      });
      const token = await fetch(cfg.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
      if (!token.ok) throw new Error(`token exchange failed: ${token.status}`);
      const { access_token } = (await token.json()) as { access_token?: string };
      if (!access_token) throw new Error("no access token");
      const user = await fetch(cfg.userinfo, { headers: { authorization: `Bearer ${access_token}` } });
      if (!user.ok) throw new Error(`user info failed: ${user.status}`);
      return cfg.read((await user.json()) as Record<string, unknown>);
    },
  };
}

/**
 * Dev and tests only: "logs in" whoever the code names, `fake:<id>:<name>`, with no network. Two of them stand in for
 * Discord and Google, to try an account with two ways in.
 */
const fakeProvider = (code: string): Provider => ({
  authorizeUrl(state, redirectUri) {
    return `${redirectUri}?${new URLSearchParams({ state, code }).toString()}`;
  },
  identify(code) {
    const [, id = "1", name = "Jugadora"] = code.split(":");
    return Promise.resolve({ id, name });
  },
});

/** Providers configured in this environment: Discord and Google need their app's id and secret; the fake one, AUTH_FAKE=1. */
export function providersFromEnv(env: NodeJS.ProcessEnv): Map<string, Provider> {
  const providers = new Map<string, Provider>();
  if (env["DISCORD_CLIENT_ID"] && env["DISCORD_CLIENT_SECRET"]) {
    providers.set(
      "discord",
      oauth({
        authorize: "https://discord.com/oauth2/authorize",
        token: "https://discord.com/api/oauth2/token",
        userinfo: "https://discord.com/api/users/@me",
        scope: "identify",
        clientId: env["DISCORD_CLIENT_ID"],
        clientSecret: env["DISCORD_CLIENT_SECRET"],
        read: (u) => ({ id: text(u["id"], ""), name: text(u["global_name"], text(u["username"], "Jugador")) }),
      }),
    );
  }
  if (env["GOOGLE_CLIENT_ID"] && env["GOOGLE_CLIENT_SECRET"]) {
    providers.set(
      "google",
      oauth({
        authorize: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
        scope: "openid profile",
        clientId: env["GOOGLE_CLIENT_ID"],
        clientSecret: env["GOOGLE_CLIENT_SECRET"],
        read: (u) => ({ id: text(u["sub"], ""), name: text(u["given_name"], text(u["name"], "Jugador")) }),
      }),
    );
  }
  // The fake provider lets anyone in as anyone: never with a production build.
  if (env["AUTH_FAKE"] === "1" && env["NODE_ENV"] !== "production") {
    providers.set("fake", fakeProvider("fake:1:Jugadora"));
    providers.set("fake2", fakeProvider("fake:2:Jugadora"));
  }
  return providers;
}

export function newState(): string {
  return randomBytes(16).toString("hex");
}
