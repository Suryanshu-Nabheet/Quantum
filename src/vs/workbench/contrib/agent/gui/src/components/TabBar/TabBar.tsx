import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius } from "..";
import { newSession } from "../../redux/slices/sessionSlice";
import {
  closeSession,
  openSession,
  pruneSessions,
  setActiveSession,
} from "../../redux/slices/tabsSlice";
import { AppDispatch, RootState } from "../../redux/store";
import { loadSession } from "../../redux/thunks/session";
import { varWithFallback } from "../../styles/theme";

const tabBorderVar = varWithFallback("border");
const tabBackgroundVar = varWithFallback("background");
const tabForegroundVar = varWithFallback("foreground");
const tabHoverBackgroundVar = varWithFallback("list-hover");
const tabAccentVar = varWithFallback("accent");

const TabBarContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  flex-shrink: 0;
  background-color: ${tabBackgroundVar};
  position: relative;
  margin-top: 2px;
  height: 27px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 5px 0 12px;
  flex: 0 0 auto;
  min-width: 100px;
  max-width: 180px;
  height: 25px;
  cursor: pointer;
  user-select: none;
  color: ${tabForegroundVar};
  background-color: ${(props) =>
    props.isActive ? tabBackgroundVar : "transparent"};
  border: 1px solid ${tabBorderVar};
  border-left: none;
  border-top: ${(props) =>
    props.isActive ? `1px solid ${tabAccentVar}` : `1px solid ${tabBorderVar}`};
  border-bottom: ${(props) => (props.isActive ? "none" : `1px solid ${tabBorderVar}`)};

  &:first-child {
    border-left: 1px solid ${tabBorderVar};
  }

  &:hover {
    background-color: ${tabHoverBackgroundVar};
  }
`;

const TabTitle = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  padding: 2px;

  &:hover {
    opacity: 1;
    background-color: ${tabHoverBackgroundVar};
  }
`;

export const TabBar = React.forwardRef<HTMLDivElement>((_, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useSelector((state: RootState) => state.session.id);
  const hasHistory = useSelector(
    (state: RootState) => state.session.history.length > 0,
  );
  const allSessionMetadata = useSelector(
    (state: RootState) => state.session.allSessionMetadata,
  );
  const openSessionIds = useSelector(
    (state: RootState) => state.tabs.openSessionIds,
  );
  const activeSessionId = useSelector(
    (state: RootState) => state.tabs.activeSessionId,
  );

  // Track the live session: opening it adds at most one tab (deduped by id).
  useEffect(() => {
    if (!currentSessionId) return;
    dispatch(openSession(currentSessionId));
  }, [currentSessionId]);

  // Drop tabs whose session file no longer exists.
  useEffect(() => {
    dispatch(pruneSessions(allSessionMetadata.map((m) => m.sessionId)));
  }, [allSessionMetadata]);

  const titleFor = (id: string): string => {
    if (id === currentSessionId) {
      const meta = allSessionMetadata.find((m) => m.sessionId === id);
      return meta?.title || "New Session";
    }
    return (
      allSessionMetadata.find((m) => m.sessionId === id)?.title || "New Session"
    );
  };

  const handleTabClick = async (id: string) => {
    if (id === activeSessionId) return;
    dispatch(setActiveSession(id));
    await dispatch(
      loadSession({ sessionId: id, saveCurrentSession: hasHistory }),
    );
  };

  const handleTabClose = async (id: string) => {
    const wasActive = id === activeSessionId;
    dispatch(closeSession(id));

    if (!wasActive) return;

    const next = openSessionIds.filter((s) => s !== id);
    if (!next.length) {
      dispatch(newSession());
      return;
    }
    const neighbour = next[Math.min(openSessionIds.indexOf(id), next.length - 1)];
    await dispatch(
      loadSession({ sessionId: neighbour, saveCurrentSession: hasHistory }),
    );
  };

  if (!openSessionIds.length) return null;

  return (
    <TabBarContainer ref={ref}>
      {openSessionIds.map((id) => (
        <Tab
          key={id}
          isActive={id === activeSessionId}
          onClick={() => void handleTabClick(id)}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              void handleTabClose(id);
            }
          }}
        >
          <TabTitle>{titleFor(id)}</TabTitle>
          <CloseButton
            onClick={(e) => {
              e.stopPropagation();
              void handleTabClose(id);
            }}
          >
            <XMarkIcon width={12} height={12} />
          </CloseButton>
        </Tab>
      ))}
    </TabBarContainer>
  );
});
