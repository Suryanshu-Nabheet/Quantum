import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import "./index.css";
import "./styles/workbenchHover.css";
import { persistor, store } from "./redux/store";
import MermaidBlock from "./components/StyledMarkdownPreview/MermaidBlock";
import "./components/StyledMarkdownPreview/agentMarkdown.css";

void (async () => {
  const container = document.getElementById("root") as HTMLElement;

  // Create React root
  const root = ReactDOM.createRoot(container);

  const diagramSource = (window as Window & { agentDiagramSource?: string })
    .agentDiagramSource;
  root.render(
    diagramSource !== undefined ? (
      <div className="agent-markdown agent-diagram-viewer">
        <MermaidBlock code={diagramSource} standalone />
      </div>
    ) : (
      <React.StrictMode>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <App />
          </PersistGate>
        </Provider>
      </React.StrictMode>
    ),
  );
})();
