import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSecurityGuardian } from "./lib/securityGuardian";

initSecurityGuardian();

createRoot(document.getElementById("root")!).render(<App />);
