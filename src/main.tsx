import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Providers from "./app/Providers";
import "./styles/tokens.css";
import "./styles/tailwind.css";
import "./styles/global.css";
import "./styles/shell.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
