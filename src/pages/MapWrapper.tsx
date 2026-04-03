import { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import {
  mapPointsToTrips,
  getTripColors,
  type MappedPoint,
} from "../lib/odoWindows";

interface RawGPSPoint {
  lat: number;
  lng: number;
  ts: string;
  s: number | null;
  f?: number;
  o?: number;
  st: "moving" | "idling" | "parked";
  a?: string;
  v?: string;
}

const VEHICLE_DRIVER: Record<string, string> = {
  TN49CS8796: "Senthil",
  TN49CS8764: "Kumar",
};
const DRIVER_VEHICLE: Record<string, string> = {
  Senthil: "TN49CS8796",
  Kumar: "TN49CS8764",
};

export default function MapWrapper() {
  const [allPoints, setAllPoints] = useState<RawGPSPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState("Senthil");

  useEffect(() => {
    fetch("/api/gps-points.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: RawGPSPoint[]) => {
        setAllPoints(data);
        setLoading(false);
      })
      .catch(() => {
        setAllPoints([]);
        setLoading(false);
      });
  }, []);

  // Filter by driver's vehicle
  const driverPoints = useMemo(() => {
    const vehicle = DRIVER_VEHICLE[selectedDriver];
    return allPoints.filter((p) => !p.v || p.v === vehicle);
  }, [allPoints, selectedDriver]);

  // Map every point to a trip via odometer
  const mappedPoints = useMemo(
    () => mapPointsToTrips(driverPoints, selectedDriver),
    [driverPoints, selectedDriver],
  );

  // Trip colors (green→blue gradient)
  const tripColors = useMemo(
    () => getTripColors(selectedDriver),
    [selectedDriver],
  );

  return (
    <MapView
      points={mappedPoints}
      tripColors={tripColors}
      loading={loading}
      selectedDriver={selectedDriver}
      onDriverChange={setSelectedDriver}
    />
  );
}
