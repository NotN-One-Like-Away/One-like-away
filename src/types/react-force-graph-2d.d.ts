declare module 'react-force-graph-2d' {
  export interface NodeObject {
    id: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number;
    fy?: number;
    [key: string]: unknown;
  }

  export interface LinkObject {
    source: string | NodeObject;
    target: string | NodeObject;
    [key: string]: unknown;
  }

  export interface GraphData<N = NodeObject, L = LinkObject> {
    nodes: N[];
    links: L[];
  }

  export interface ForceGraphMethods {
    d3Force: (forceName: string, force?: unknown) => unknown;
    d3ReheatSimulation: () => void;
    centerAt: (x?: number, y?: number, ms?: number) => void;
    zoom: (k?: number, ms?: number) => void;
    zoomToFit: (ms?: number, px?: number) => void;
    pauseAnimation: () => void;
    resumeAnimation: () => void;
    refresh: () => void;
  }

  export interface ForceGraphProps<N = NodeObject, L = LinkObject> {
    graphData: GraphData<N, L>;
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeRelSize?: number;
    nodeId?: string;
    nodeLabel?: string | ((node: N) => string);
    nodeVal?: number | ((node: N) => number);
    nodeColor?: string | ((node: N) => string);
    nodeAutoColorBy?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeCanvasObject?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodePointerAreaPaint?: (node: any, color: string, ctx: CanvasRenderingContext2D) => void;
    linkSource?: string;
    linkTarget?: string;
    linkLabel?: string | ((link: L) => string);
    linkColor?: string | ((link: L) => string);
    linkAutoColorBy?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linkWidth?: number | ((link: any) => number);
    linkCurvature?: number | ((link: L) => number);
    linkDirectionalParticles?: number | ((link: L) => number);
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    cooldownTime?: number;
    cooldownTicks?: number;
    onNodeClick?: (node: N, event: MouseEvent) => void;
    onNodeHover?: (node: N | null, previousNode: N | null) => void;
    onLinkClick?: (link: L, event: MouseEvent) => void;
    onLinkHover?: (link: L | null, previousLink: L | null) => void;
    onEngineStop?: () => void;
    enableNodeDrag?: boolean;
    enableZoomInteraction?: boolean;
    enablePanInteraction?: boolean;
  }

  const ForceGraph2D: React.ForwardRefExoticComponent<
    ForceGraphProps & React.RefAttributes<ForceGraphMethods>
  >;

  export default ForceGraph2D;
  export { ForceGraphMethods };
}
