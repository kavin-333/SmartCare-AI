import { useState } from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import Auth from "./Auth.jsx";
import "./index.css";

function Root() {
  const [isAuthenticated, setIsAuthenticated] =
    useState(!!localStorage.getItem("token"));

  function handleAuthenticated() {
    setIsAuthenticated(true);
  }

  if (!isAuthenticated) {
    return (
      <Auth
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return <App />;
}

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <Root />
);
