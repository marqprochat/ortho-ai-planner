import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Debug SSO - Remove after fixing
console.log('[PLANNER MAIN] App starting...');
console.log('[PLANNER MAIN] URL:', window.location.href);
console.log('[PLANNER MAIN] Search params:', window.location.search);
const urlParams = new URLSearchParams(window.location.search);
console.log('[PLANNER MAIN] Token in URL:', urlParams.get('token') ? 'YES' : 'NO');

createRoot(document.getElementById("root")!).render(<App />);

