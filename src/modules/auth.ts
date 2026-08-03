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
  const sharingUrl = `${config.portalUrl}/sharing`;

  try {
    await IdentityManager.checkSignInStatus(sharingUrl);
  } catch {
    // Not signed in yet (rejects with "identity-manager:not-authenticated").
    // This is the expected first-visit case, not an error — kick off the
    // OAuth flow. With popup:false this performs a full-page redirect to
    // the portal's login page, so nothing after this call runs until the
    // browser navigates back with the auth code and this module re-runs.
    await IdentityManager.getCredential(sharingUrl);
  }

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
