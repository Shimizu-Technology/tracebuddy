import type { StyleProp, ViewStyle } from 'react-native';
import type { ARNativeState, ARPlacementMode } from '../../../src/features/ar/arTraceState';

export type TraceBuddyARViewProps = {
  active?: boolean;
  guideImageUri?: string;
  placementMode: ARPlacementMode;
  opacity: number;
  scale: number;
  rotationDegrees: number;
  offsetXmeters: number;
  offsetYmeters: number;
  paperWidthMeters: number;
  paperHeightMeters: number;
  placeRevision: number;
  resetRevision: number;
  onStateChange?: (event: { nativeEvent: ARNativeState }) => void;
  style?: StyleProp<ViewStyle>;
};
