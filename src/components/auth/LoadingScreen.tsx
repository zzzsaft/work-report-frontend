import styles from "./AuthShared.module.less";

export function LoadingScreen({ text }: { text: string }) {
  return (
    <main className={styles["loading-screen"]} aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </main>
  );
}
