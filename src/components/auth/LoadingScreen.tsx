export function LoadingScreen({ text }: { text: string }) {
  return (
    <main className="loading-screen" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </main>
  );
}
