import { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "./api";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <main>
      <h1>Kevred</h1>
      {error && <p>Error: {error}</p>}
      {!error && !health && <p>Loading…</p>}
      {health && (
        <dl>
          <dt>API</dt>
          <dd>{health.status}</dd>
          <dt>MongoDB</dt>
          <dd>{health.mongo}</dd>
        </dl>
      )}
    </main>
  );
}
