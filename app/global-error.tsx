"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1>Something went wrong</h1>
          <p>Please try again. If it keeps happening, call the front desk.</p>
          <button
            onClick={reset}
            style={{ padding: "0.75rem 1.5rem", borderRadius: 999, border: 0, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
