"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(params.get("next") || "/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Senha incorreta.");
    }
  }

  return (
    <div style={styles.wrap}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.mark}>D</div>
        <h1 style={styles.title}>Painel de Leads</h1>
        <p style={styles.subtitle}>Digite a senha de acesso para continuar.</p>
        <input
          style={styles.input}
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const styles = {
  wrap: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F5F6F8",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    border: "1px solid #E2E5EA",
    borderRadius: 16,
    padding: "32px 28px",
    width: 320,
    boxShadow: "0 4px 24px rgba(20,24,32,0.08)",
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "#2B6E62",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: "#1A1D23" },
  subtitle: { fontSize: 13, color: "#5B6472", margin: "0 0 18px" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #E2E5EA",
    fontSize: 14,
    marginBottom: 10,
    boxSizing: "border-box",
  },
  error: { color: "#B4483D", fontSize: 12.5, margin: "0 0 10px" },
  button: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "none",
    background: "#2B6E62",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
