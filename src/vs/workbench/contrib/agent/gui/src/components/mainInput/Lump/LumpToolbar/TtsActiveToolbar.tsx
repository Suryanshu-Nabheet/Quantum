import { useContext } from "react";
import styled from "styled-components";
import { HostBridgeContext } from "../../../../context/HostBridge";
import { getFontSize } from "../../../../util";
import { GeneratingIndicator } from "./GeneratingIndicator";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StopButton = styled.div`
  font-size: ${getFontSize() - 3}px;
  padding: 2px;
  padding-right: 4px;
  cursor: pointer;
`;

export function TtsActiveToolbar() {
  const hostBridge = useContext(HostBridgeContext);

  return (
    <Container>
      <GeneratingIndicator />
      <StopButton
        className="text-description"
        onClick={() => {
          hostBridge.post("tts/kill", undefined);
        }}
      >
        ■ Stop TTS
      </StopButton>
    </Container>
  );
}
