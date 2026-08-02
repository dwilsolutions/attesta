import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { FONT_LINK } from "./lib/theme";

const link = document.createElement("link");
link.rel = "stylesheet";
link.href = FONT_LINK;
document.head.appendChild(link);

document.body.style.margin = "0";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
