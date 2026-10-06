import { useState, type FormEvent } from "react";
import { ArrowRight, Flame, LockKeyhole, Mail } from "lucide-react";
import { Link } from "react-router-dom";

type AuthMode = "sign-in" | "sign-up" | "reset";

interface AuthScreenProps {
  busy: boolean;
  error: string | null;
  online: boolean;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSignUp: (name: string, email: string, password: string) => Promise<boolean>;
  onResetPassword: (email: string) => Promise<boolean>;
}

export function AuthScreen({
  busy,
  error,
  online,
  onSignIn,
  onSignUp,
  onResetPassword,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!online) return;
    const success =
      mode === "sign-up"
        ? await onSignUp(name.trim(), email.trim(), password)
        : mode === "reset"
          ? await onResetPassword(email.trim())
          : await onSignIn(email.trim(), password);
    if (success && mode === "reset") {
      setNotice("If an account matches this email, a reset link will arrive shortly.");
    } else if (success && mode === "sign-up") {
      setNotice("Check your inbox to confirm your email address before signing in.");
    }
  }

  const isReset = mode === "reset";
  const isSignUp = mode === "sign-up";

  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <div className="brand-lockup">
          <span className="brand-mark"><Flame size={21} fill="currentColor" /></span>
          <span>OSU<span className="brand-dot">.</span></span>
        </div>
        <div className="auth-brand-copy">
          <span className="eyebrow">THE DOJO NETWORK</span>
          <h1>Discipline.<br />Community.<br /><em>Growth.</em></h1>
          <p>A home for every dojo, every student, and every step on the way.</p>
        </div>
        <div className="auth-brand-footer">
          <span className="brand-divider" />
          <span>KYOKUSHIN KARATE · EST. 1964</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <span className="eyebrow auth-mobile-eyebrow">OSU DOJO NETWORK</span>
          <h2>{isReset ? "Reset your password" : isSignUp ? "Start your journey" : "Welcome back"}</h2>
          <p className="muted">
            {isReset
              ? "We’ll email you a secure link to reset your password."
              : isSignUp
                ? "Create a student account to discover dojos and track your progress."
                : "Sign in to continue to your dojo community."}
          </p>

          <form className="auth-form" onSubmit={submit}>
            {isSignUp && (
              <label className="field">
                <span>Your name</span>
                <input
                  autoComplete="name"
                  maxLength={100}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder="e.g. Jamie Chen"
                  required
                  value={name}
                />
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <div className="input-with-icon">
                <Mail size={17} aria-hidden="true" />
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </label>
            {!isReset && (
              <label className="field">
                <span>Password</span>
                <div className="input-with-icon">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    minLength={8}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    placeholder="At least 8 characters"
                    required
                    type="password"
                    value={password}
                  />
                </div>
              </label>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}
            {notice && <div className="form-notice" role="status">{notice}</div>}
            {!online && <div className="form-error" role="status">Offline. Reconnect to sign in or create an account.</div>}
            <button className="button button-primary auth-submit" disabled={busy || !online} type="submit">
              {busy ? "Please wait…" : !online ? "Offline" : isReset ? "Send reset link" : isSignUp ? "Create account" : "Sign in"}
              {!busy && online && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth-links">
            {mode === "sign-in" && (
              <>
                <button className="text-button" onClick={() => setMode("reset")} type="button">Forgot password?</button>
                <span>New to the network? <button onClick={() => setMode("sign-up")} type="button">Create an account</button></span>
              </>
            )}
            {isSignUp && <span>Already have an account? <button onClick={() => setMode("sign-in")} type="button">Sign in</button></span>}
            {isReset && <span>Remembered it? <button onClick={() => setMode("sign-in")} type="button">Back to sign in</button></span>}
          </div>
          <p className="auth-role-note">Sensei accounts are activated by a dojo network administrator. <Link className="text-link" to="/directory">Browse published dojos</Link></p>
        </div>
      </section>
    </main>
  );
}
