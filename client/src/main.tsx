import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import Providers from "./app/Providers";
import RootErrorBoundary from "./app/RootErrorBoundary";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/tailwind.css";
import "./styles/global.css";
import "./styles/shell.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </RootErrorBoundary>
  </React.StrictMode>,
);
