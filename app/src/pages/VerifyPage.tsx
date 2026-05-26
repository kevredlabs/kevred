import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { verifyMagicLink } from "../api";
import "../login.css";

type Status = "verifying" | "success" | "error";

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing token.");
      setStatus("error");
      return;
    }

    verifyMagicLink(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/"), 1000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Verification failed");
        setStatus("error");
      });
  }, []);

  return (
    <div className="login-root">
      <div className="card">
        <div className="logo">
          <img src="/logo_kevred_pixel.svg" className="logo-mark" alt="" />
          kevred
        </div>

        {status === "verifying" && (
          <>
            <h1>Signing you in…</h1>
            <p className="sub">Just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="verify-icon">✓</div>
            <h1>Signed in</h1>
            <p className="sub">Redirecting…</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1>Link invalid or expired</h1>
            <p className="sub">{error}</p>
            <Link to="/login" className="btn-primary" style={{ display: "block", textAlign: "center", marginTop: 24 }}>
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
