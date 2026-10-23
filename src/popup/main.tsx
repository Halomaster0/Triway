import { createRoot } from "react-dom/client";
import { BASE_CSS, PAGE_CSS } from "../ui/styles";
import { Popup } from "./Popup";

const style = document.createElement("style");
style.textContent = BASE_CSS + PAGE_CSS + "body{margin:0}";
document.head.append(style);
createRoot(document.getElementById("root")!).render(<Popup />);
