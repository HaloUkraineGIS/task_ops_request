// Must be imported before anything that touches the ArcGIS JS API's
// networking layer (WebMap, PortalItem, esriRequest, etc.). Without this,
// esri/config.portalUrl defaults to "https://www.arcgis.com" — so calls
// like `new WebMap({ portalItem: { id } })` resolve against ArcGIS Online
// instead of this org's Enterprise portal, and fail with
// "Item does not exist or is inaccessible." even for a perfectly valid
// item ID, because the item simply isn't on arcgis.com.
//
// OAuthInfo/IdentityManager (see auth.ts) knowing the portal URL is a
// *separate* concern from this — that only covers the sign-in flow, not
// this global default used by every other module.
import esriConfig from "@arcgis/core/config";
import { config } from "../config";

esriConfig.portalUrl = config.portalUrl;
