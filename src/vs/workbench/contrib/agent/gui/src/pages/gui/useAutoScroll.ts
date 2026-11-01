import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatHistoryItemWithMessageId } from "../../redux/slices/sessionSlice";

const BOTTOM_THRESHOLD_PX = 2;

/**
 * Resume following when a new user turn or session begins, but preserve a
 * reader's position as assistant and tool messages stream into the thread.
 */
function getNumUserMsgs(history: ChatHistoryItemWithMessageId[]) {
  return history.filter((msg) => msg.message.role === "user").length;
}

export const useAutoScroll = (
  ref: React.RefObject<HTMLDivElement>,
  history: ChatHistoryItemWithMessageId[],
  sessionId?: string,
) => {
  const shouldFollowRef = useRef(true);
  const isJumpingToBottomRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const numUserMsgs = useMemo(() => getNumUserMsgs(history), [history]);

  useEffect(() => {
    shouldFollowRef.current = true;
    isJumpingToBottomRef.current = false;
    setIsAtBottom(true);
    const element = ref.current;
    if (!element || numUserMsgs === 0) return;

    const frame = window.requestAnimationFrame(() => {
      if (shouldFollowRef.current) {
        element.scrollTop = element.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [numUserMsgs, ref, sessionId]);

  const scrollToBottom = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    shouldFollowRef.current = true;
    isJumpingToBottomRef.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [ref]);

  useEffect(() => {
    if (!ref.current || history.length === 0) return;
    const element = ref.current;
    let scrollFrame = 0;

    const handleScroll = () => {
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
      if (atBottom) {
        isJumpingToBottomRef.current = false;
        shouldFollowRef.current = true;
      } else if (!isJumpingToBottomRef.current) {
        shouldFollowRef.current = false;
      }
      setIsAtBottom(atBottom);
    };

    const handleWheel = (event: WheelEvent) => {
      const hasOverflow = element.scrollHeight > element.clientHeight;
      if (event.deltaY < 0 && hasOverflow) {
        isJumpingToBottomRef.current = false;
        shouldFollowRef.current = false;
        setIsAtBottom(false);
      } else if (
        element.scrollHeight - element.scrollTop - element.clientHeight <=
        BOTTOM_THRESHOLD_PX
      ) {
        shouldFollowRef.current = true;
        setIsAtBottom(true);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!shouldFollowRef.current || scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        // Re-check after scheduling so a user's upward scroll always wins.
        if (shouldFollowRef.current) {
          if (isJumpingToBottomRef.current) {
            element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
          } else {
            element.scrollTop = element.scrollHeight;
            setIsAtBottom(true);
          }
        }
      });
    });

    element.addEventListener("scroll", handleScroll, { passive: true });
    element.addEventListener("wheel", handleWheel, { passive: true });

    resizeObserver.observe(element);

    // Observe the history stack so streaming Markdown and loaded media can
    // extend the thread without moving the reader unless they were at the end.
    Array.from(element.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    return () => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      resizeObserver.disconnect();
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("wheel", handleWheel);
    };
  }, [ref, history.length]);

  return {
    showScrollToBottom: !isAtBottom,
    scrollToBottom,
  };
};
