import { createRoot } from "react-dom/client";
import "./api/client/interceptors";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
