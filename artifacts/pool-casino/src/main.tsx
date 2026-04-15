import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@/lib/api-client-react/src";
import App from "./App";
import "./index.css";

setBaseUrl((import.meta.env.VITE_API_URL as string | undefined) ?? null);

createRoot(document.getElementById("root")!).render(<App />);
