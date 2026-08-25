import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/fragment-mono/400.css";
import "@fontsource/saira-condensed/500.css";
import "@fontsource/saira-condensed/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { useClusterMapController } from "./controllers/useClusterMapController";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./views/App";

function Root() {
  const controller = useClusterMapController();
  return <App controller={controller} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
