"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f7f7", color: "#333" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#707070" }}>Please try again in a moment.</p>
          <button type="button" onClick={() => retry()} style={{ minHeight: 48, padding: "0 28px", borderRadius: 999, border: 0, background: "#d70f64", color: "#fff", fontSize: 17, fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
