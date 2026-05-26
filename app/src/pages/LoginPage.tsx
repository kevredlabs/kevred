import { useState } from "react";
import { requestMagicLink } from "../api";
import "../login.css";

type Status = "idle" | "loading" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      await requestMagicLink(email);
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="login-root">
      <div className="card">
        <div className="logo">
          <img src="/logo_kevred_pixel.svg" className="logo-mark" alt="" />
          kevred
        </div>

        {status === "sent" ? (
          <>
            <div className="verify-icon">📬</div>
            <h1>Check your inbox</h1>
            <p className="sub">
              We sent a link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </>
        ) : (
          <>
            <h1>Sign in to kevred</h1>
            <p className="sub">We will send you a link to connect.</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
              />
              <button type="submit" className="btn-primary" disabled={status === "loading"}>
                {status === "loading" ? "Sending…" : "Send link"}
              </button>
            </form>

            {status === "error" && <p className="error-msg">{error}</p>}

            <p className="info">
              New here? The same link creates your account on first sign-in.
            </p>

            <p className="legal">
              By continuing, you agree to our{" "}
              <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
