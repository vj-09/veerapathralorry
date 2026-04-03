import { Routes, Route, Navigate } from "react-router-dom";
import { FleetProvider } from "./lib/FleetContext";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Trips from "./pages/Trips";
import Drivers from "./pages/Drivers";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <FleetProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="trips" element={<Trips />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FleetProvider>
  );
}
