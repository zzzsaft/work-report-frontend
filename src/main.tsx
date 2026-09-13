import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ConfirmationProvider } from "./components/ui/ConfirmationProvider";
import "@jc-times/business-ui/styles.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfirmationProvider><App /></ConfirmationProvider>
  </StrictMode>
);
