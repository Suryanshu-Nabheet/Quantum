import React from 'react';
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const ShimmerContainer = styled.span<{ duration?: number }>`
  font-size: inherit;
  font-weight: inherit;
  font-family: var(--vscode-font-family, inherit);
  
  background: linear-gradient(
    90deg,
    var(--vscode-descriptionForeground, #999) 0%,
    var(--vscode-descriptionForeground, #999) 40%,
    var(--vscode-foreground, #fff) 50%,
    var(--vscode-descriptionForeground, #999) 60%,
    var(--vscode-descriptionForeground, #999) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
  animation: ${shimmer} ${props => props.duration || 3}s infinite linear;
`;

interface TextShimmerProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export const TextShimmer: React.FC<TextShimmerProps> = ({ children, className, duration }) => {
  return (
    <ShimmerContainer className={className} duration={duration}>
      {children}
    </ShimmerContainer>
  );
};
