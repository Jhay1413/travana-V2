import { Component, type ErrorInfo, type ReactNode } from "react";

interface GlobeErrorBoundaryProps {
  children: ReactNode;
  /** Called when rendering the globe throws, or the WebGL context is lost. */
  onError: (error: unknown) => void;
}

interface GlobeErrorBoundaryState {
  hasError: boolean;
}

// Catches render-time failures from the 3D globe subtree (e.g. WebGL context
// creation failing) so the page can fall back to a List view instead of
// crashing. Also listens for `webglcontextlost` on any <canvas> it renders,
// which React error boundaries do not catch on their own.
export class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, GlobeErrorBoundaryState> {
  state: GlobeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GlobeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    void info;
    this.props.onError(error);
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.props.onError(new Error("WebGL context lost"));
  };

  componentDidMount(): void {
    window.addEventListener("webglcontextlost", this.handleContextLost, true);
  }

  componentWillUnmount(): void {
    window.removeEventListener("webglcontextlost", this.handleContextLost, true);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
