import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { WaveMark } from "../icons";

type Mode = "signIn" | "signUp";

export function AuthScreen() {
  const { signIn, signUp, mode: backendMode } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      if (mode === "signIn") {
        const result = await signIn(email, password);
        if (result.error) setError(result.error);
      } else {
        const result = await signUp(email, password);
        if (result.error) {
          setError(result.error);
        } else if (result.needsConfirmation) {
          setMode("signIn");
          setInfo("Account created. Confirm your email from the message we sent, then sign in.");
        }
        // Otherwise the new session is already active and the app takes over.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = mode === "signIn" ? "Sign in" : "Create account";

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <WaveMark size={28} />
          <span>Wavelength</span>
        </div>
        <h1 className="auth-title">Your music, wherever you are</h1>
        <p className="auth-subtitle">
          Upload the songs you own, then play them from any device.
        </p>

        {backendMode === "demo" && (
          <p className="auth-demo">
            Demo mode: no backend is connected, so any email and password work
            and nothing is saved when you reload.
          </p>
        )}

        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signIn"}
            className={mode === "signIn" ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("signIn")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signUp"}
            className={mode === "signUp" ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("signUp")}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={backendMode === "supabase" ? 6 : undefined}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signUp" && backendMode === "supabase" && (
              <small>At least 6 characters.</small>
            )}
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="form-info" role="status">
              {info}
            </p>
          )}

          <button type="submit" className="btn-primary btn-primary--wide" disabled={submitting}>
            {submitting ? "Please wait…" : submitLabel}
          </button>
        </form>
      </div>
    </main>
  );
}
