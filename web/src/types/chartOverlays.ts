// C:\TraderBotWeb\web\src\types\chartOverlays.ts

export type OverlayLine = {
  id: string;
  label: string;
  value: number;
  top: number;
  color: string;
  dashed?: boolean;
};

export type OverlayMarker = {
  id: string;
  label: string;
  price: number;
  left: number;
  top: number;
  color: string;
  timeLabel: string;
};

export type OverlayBox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  borderColor: string;
  borderWidth?: number;
  dashed?: boolean;
  label?: string;
  labelColor?: string;
  labelBackground?: string;
};

export type OverlayCircle = {
  id: string;
  left: number;
  top: number;
  radius: number;
  color: string;
  borderColor?: string;
  borderWidth?: number;
  dashed?: boolean;
  label?: string;
  labelColor?: string;
  labelBackground?: string;
};

export type OverlaySegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  dashed?: boolean;
  label?: string;
  labelColor?: string;
  labelBackground?: string;
};

export type OverlayText = {
  id: string;
  left: number;
  top: number;
  text: string;
  color: string;
  background: string;
  borderColor?: string;
};

export type ChartOverlaySet = {
  markers: OverlayMarker[];
  lines: OverlayLine[];
  boxes: OverlayBox[];
  circles: OverlayCircle[];
  segments: OverlaySegment[];
  texts: OverlayText[];
};

export function createEmptyChartOverlays(): ChartOverlaySet {
  return {
    markers: [],
    lines: [],
    boxes: [],
    circles: [],
    segments: [],
    texts: [],
  };
}