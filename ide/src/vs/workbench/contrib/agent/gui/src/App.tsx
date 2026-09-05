import { lazy, Suspense, type ReactNode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Layout from "./components/Layout";
import { WorkbenchHoverHost } from "./components/gui/WorkbenchHoverHost";
import { MainEditorProvider } from "./components/mainInput/TipTapEditor";
import { SubmenuContextProvidersProvider } from "./context/SubmenuContextProviders";
import { VscThemeProvider } from "./context/VscTheme";
import ParallelListeners from "./hooks/ParallelListeners";
import ErrorPage from "./pages/error";

import { ROUTES } from "./util/navigation";

const Chat = lazy(() => import("./pages/gui"));
const ConfigPage = lazy(() => import("./pages/config"));
const History = lazy(() => import("./pages/history"));

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const router = createMemoryRouter(
  [
    {
      path: ROUTES.HOME,
      element: <Layout />,
      errorElement: <ErrorPage />,
      children: [
        {
          path: "/index.html",
          element: <LazyRoute><Chat /></LazyRoute>,
        },
        {
          path: ROUTES.HOME,
          element: <LazyRoute><Chat /></LazyRoute>,
        },
        {
          path: "/history",
          element: <LazyRoute><History /></LazyRoute>,
        },

        {
          path: ROUTES.CONFIG,
          element: <LazyRoute><ConfigPage /></LazyRoute>,
        },
      ],
    },
  ],
  {
    initialEntries: [(window as any).initialRoute || ROUTES.HOME],
  },
);

/*
  ParallelListeners prevents entire app from rerendering on any change in the listeners,
  most of which interact with redux etc.
*/
function App() {
  return (
    <VscThemeProvider>
      <MainEditorProvider>
        <SubmenuContextProvidersProvider>
          <RouterProvider router={router} />
        </SubmenuContextProvidersProvider>
      </MainEditorProvider>
      <WorkbenchHoverHost />
      <ParallelListeners />
    </VscThemeProvider>
  );
}

export default App;
