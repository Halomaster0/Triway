import { createRoot } from "react-dom/client";
import { BASE_CSS, PAGE_CSS } from "../ui/styles";
import { Options } from "./Options";

const style = document.createElement("style");
style.textContent = BASE_CSS + PAGE_CSS;
document.head.append(style);
createRoot(document.getElementById("root")!).render(<Options />);
