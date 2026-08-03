import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import LayerList from "@arcgis/core/widgets/LayerList";
import Expand from "@arcgis/core/widgets/Expand";
import Polygon from "@arcgis/core/geometry/Polygon";
import { config } from "../config";

let view: MapView;
let draftLayer: GraphicsLayer;
const markersByRowId = new Map<string, Graphic>();

const TEAL = [63, 182, 199, 1];
const GREEN = [76, 175, 125, 1];

export async function initMap(container: HTMLDivElement): Promise<MapView> {
  const webmap = new WebMap({ portalItem: { id: config.webMapId } });

  draftLayer = new GraphicsLayer({ title: "Draft task markers" });
  webmap.add(draftLayer);

  view = new MapView({
    container,
    map: webmap,
    popupEnabled: false,
  });

  await view.when();

  const layerList = new LayerList({ view });
  const expand = new Expand({
    view,
    content: layerList,
    expandIcon: "layers",
    expandTooltip: "Layers",
  });
  view.ui.add(expand, "top-right");

  return view;
}

function markerSymbol(color: number[]): __esri.SimpleMarkerSymbolProperties {
  return {
    type: "simple-marker",
    style: "circle",
    color,
    size: 10,
    outline: { color: [11, 17, 19, 1], width: 1.5 },
  };
}

export function setDraftMarker(
  rowId: string,
  latitude: number,
  longitude: number,
  zoomTo = true
) {
  removeMarker(rowId);
  const graphic = new Graphic({
    geometry: { type: "point", latitude, longitude } as __esri.PointProperties,
    symbol: markerSymbol(TEAL) as unknown as __esri.SymbolProperties,
  });
  draftLayer.add(graphic);
  markersByRowId.set(rowId, graphic);

  if (zoomTo) {
    view.goTo(
      { center: [longitude, latitude], zoom: Math.max(view.zoom, 12) },
      { duration: 800, easing: "ease-in-out" }
    );
  }
}

export function markMarkerSaved(rowId: string) {
  const graphic = markersByRowId.get(rowId);
  if (graphic) {
    graphic.symbol = markerSymbol(GREEN) as unknown as __esri.Symbol;
  }
}

export function removeMarker(rowId: string) {
  const existing = markersByRowId.get(rowId);
  if (existing) {
    draftLayer.remove(existing);
    markersByRowId.delete(rowId);
  }
}

export function clearAllMarkers() {
  draftLayer.removeAll();
  markersByRowId.clear();
}

export function zoomToZone(geometry: Polygon) {
  view.goTo(geometry, { duration: 800, easing: "ease-in-out" });
}

export function getView(): MapView {
  return view;
}
