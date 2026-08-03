import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import Portal from "@arcgis/core/portal/Portal";
import { config } from "../config";

export type CurrentUser = {
  username: string;
  fullName: string;
};

const info = new OAuthInfo({
  appId: config.oauthAppId,
  portalUrl: config.portalUrl,
  // Full-page redirect is more reliable than a popup with corporate
  // SAML/ADFS SSO flows.
  popup: false,
});

IdentityManager.registerOAuthInfos([info]);

/**
 * Ensures the user has an active SSO session, redirecting through the
 * portal's OAuth flow if necessary. Resolves with basic profile info once
 * signed in.
 */
export async function ensureSignedIn(): Promise<CurrentUser> {
  await IdentityManager.checkSignInStatus(`${config.portalUrl}/sharing`);

  const portal = new Portal({ url: config.portalUrl, authMode: "immediate" });
  await portal.load();

  const user = portal.user;
  return {
    username: user?.username ?? "unknown",
    fullName: user?.fullName ?? user?.username ?? "Unknown user",
  };
}

export function signOut(): void {
  IdentityManager.destroyCredentials();
  window.location.reload();
}
