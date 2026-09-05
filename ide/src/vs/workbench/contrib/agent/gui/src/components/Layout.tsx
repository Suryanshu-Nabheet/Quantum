import { useContext, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv } from ".";

import { IdeMessengerContext } from "../context/IdeMessenger";
import { LocalStorageProvider } from "../context/LocalStorage";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCodeToEdit } from "../redux/slices/editState";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { enterEdit, exitEdit } from "../redux/thunks/edit";
import { saveCurrentSession } from "../redux/thunks/session";
import { fontSize, isMetaEquivalentKeyPressed } from "../util";
import { CONFIG_ROUTES, ROUTES } from "../util/navigation";
import { FatalErrorIndicator } from "./config/FatalErrorNotice";
import TextDialog from "./dialogs";
import { GenerateRuleDialog } from "./GenerateRuleDialog";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { useMainEditor } from "./mainInput/TipTapEditor";

import OSRContextMenu from "./OSRContextMenu";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  position: relative;
  overflow-x: hidden;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  const ideMessenger = useContext(IdeMessengerContext);

  const { mainEditor } = useMainEditor();
  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);

  const showDialog = useAppSelector((state) => state.ui.showDialog);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const isHome =
    location.pathname === ROUTES.HOME ||
    location.pathname === ROUTES.HOME_INDEX;

  useNavigationListener();


  useEffect(() => {
    if (location.pathname === ROUTES.CONFIG && !(window as any).isFullScreen) {
      ideMessenger.post("openConfigPage", undefined);
      navigate(ROUTES.HOME);
    }
  }, [location.pathname, ideMessenger, navigate]);

  // Lock full-screen mode to config/features only
  useEffect(() => {
    if (isHome && (window as any).isFullScreen) {
      navigate(ROUTES.CONFIG);
    }
  }, [isHome, navigate]);

  useWebviewListener(
    "newSession",
    async () => {
      if (!(window as any).isFullScreen) {
        navigate(ROUTES.HOME);
      }
      if (isInEdit) {
        await dispatch(exitEdit({}));
      } else {
        await dispatch(
          saveCurrentSession({
            openNewSession: true,
            generateTitle: true,
          }),
        );
      }
    },
    [isInEdit],
  );

  useWebviewListener(
    "isAgentInputFocused",
    async () => {
      return false;
    },
    [isHome],
    isHome,
  );

  useWebviewListener(
    "focusAgentInputWithNewSession",
    async () => {
      if (!(window as any).isFullScreen) {
        navigate(ROUTES.HOME);
      }
      if (isInEdit) {
        await dispatch(
          exitEdit({
            openNewSession: true,
          }),
        );
      } else {
        await dispatch(
          saveCurrentSession({
            openNewSession: true,
            generateTitle: true,
          }),
        );
      }
    },
    [isHome, isInEdit],
    isHome,
  );

  useWebviewListener(
    "addModel",
    async () => {
      navigate(CONFIG_ROUTES.MODELS);
    },
    [navigate],
  );

  useWebviewListener(
    "navigateTo",
    async (data) => {
      if (data.toggle && location.pathname === data.path) {
        navigate((window as any).isFullScreen ? ROUTES.CONFIG : "/");
      } else {
        // Prevent accidental navigation to chat or history in full screen
        // These should only open in the sidebar
        if (
          (window as any).isFullScreen &&
          (data.path === "/" || data.path === "/history")
        ) {
          return;
        }
        navigate(data.path);
      }
    },
    [location, navigate],
  );


  useWebviewListener(
    "focusEdit",
    async () => {
      await ideMessenger.request("edit/addCurrentSelection", undefined);
      await dispatch(enterEdit({ editorContent: mainEditor?.getJSON() }));
      mainEditor?.commands.focus();
    },
    [ideMessenger, mainEditor],
  );

  useWebviewListener(
    "setCodeToEdit",
    async (payload) => {
      dispatch(
        setCodeToEdit({
          codeToEdit: payload,
        }),
      );
    },
    [],
  );

  useWebviewListener(
    "exitEditMode",
    async () => {
      await dispatch(exitEdit({}));
    },
    [],
  );

  useWebviewListener(
    "generateRule",
    async () => {
      dispatch(setShowDialog(true));
      dispatch(setDialogMessage(<GenerateRuleDialog />));
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (isMetaEquivalentKeyPressed(event) && event.code === "KeyC") {
        const selection = window.getSelection()?.toString();
        if (selection) {
          setTimeout(() => {
            void navigator.clipboard.writeText(selection);
          }, 100);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);


  return (
    <LocalStorageProvider>

        <LayoutTopDiv>
          <OSRContextMenu />
          <div
            style={{
              scrollbarGutter: "stable",
              minHeight: "100%",
              display: "grid",
              gridTemplateRows: "1fr auto",
            }}
          >
            <TextDialog
              showDialog={showDialog}
              onEnter={() => {
                dispatch(setShowDialog(false));
              }}
              onClose={() => {
                dispatch(setShowDialog(false));
              }}
              message={dialogMessage}
            />

            <GridDiv>
              <Outlet />
              {/* The fatal error for chat is shown below input */}
              {!isHome && <FatalErrorIndicator />}
            </GridDiv>
          </div>
          <div style={{ fontSize: fontSize(-4) }} id="tooltip-portal-div" />
        </LayoutTopDiv>

    </LocalStorageProvider>
  );
};

export default Layout;
