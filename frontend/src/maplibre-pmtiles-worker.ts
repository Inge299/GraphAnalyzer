import 'maplibre-gl/dist/maplibre-gl-worker.mjs';
import { Protocol } from 'pmtiles';

// MapLibre 6 resolves vector tiles in its worker.  Registering the PMTiles
// protocol only on the window is not enough: the worker has its own protocol
// registry (self.addProtocol).
const pmtilesProtocol = new Protocol();
const workerScope = self as typeof self & {
  addProtocol?: (name: string, handler: unknown) => void;
};
workerScope.addProtocol?.('pmtiles', pmtilesProtocol.tile);
