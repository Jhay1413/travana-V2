import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { GLOBE_RADIUS, isFacingCamera, latLngToVector3 } from "../../lib/geo";
import type { GuruDestinationItem } from "../../types";

// Pins sit a hair above the hex-polygon land surface so they don't z-fight
// with it. The selected pin sits slightly higher still + draws with a
// higher renderOrder so it stays legible on top of near neighbours in
// dense clusters (e.g. the Greek islands / Balearics).
const PIN_ALTITUDE_RADIUS = GLOBE_RADIUS * 1.005;
const PIN_ALTITUDE_RADIUS_SELECTED = GLOBE_RADIUS * 1.012;
const DRAG_THRESHOLD_PX = 8;
const HOVER_CARD_OFFSET_Y = 18;
const UP = new Vector3(0, 1, 0);

// Pins keep a roughly constant on-screen size by scaling inversely with
// camera zoom (world-size shrinks as the camera moves closer), clamped so
// they never vanish or blow up.
const SCALE_REFERENCE_DISTANCE = 300; // matches the default camera distance
const MIN_PIN_SCALE = 0.4;
const MAX_PIN_SCALE = 1.3;

type PinnableItem = GuruDestinationItem & { lat: number; lng: number };

function isPinnable(item: GuruDestinationItem): item is PinnableItem {
  return item.lat !== null && item.lng !== null;
}

/**
 * Precomputes, per item, the chord distance (in scene units, at
 * PIN_ALTITUDE_RADIUS) to its nearest neighbour. With ~128 real-world
 * destinations heavily clustered (Greek islands, Balearics, Canaries…),
 * this is used to cap each pin's invisible hit-sphere so dense clusters
 * don't have neighbouring hit areas swallow each other. O(n^2) but n is
 * small (low hundreds) and this only recomputes when the item list changes.
 */
function computeNearestNeighborDistances(items: PinnableItem[]): Map<string, number> {
  const positions = items.map((item) => latLngToVector3(item.lat, item.lng, PIN_ALTITUDE_RADIUS));
  const distances = new Map<string, number>();

  for (let i = 0; i < items.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dz = positions[i].z - positions[j].z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < minDist) minDist = dist;
    }
    distances.set(items[i].key, minDist);
  }

  return distances;
}

interface DestinationPinsProps {
  items: GuruDestinationItem[];
  selectedKey: string | null;
  hoveredKey: string | null;
  onHoverChange: (key: string | null) => void;
  onPinClick: (key: string) => void;
  pinColor: string;
  pinSelectedColor: string;
  hoverCardRef: RefObject<HTMLDivElement | null>;
  containerSize: { width: number; height: number };
}

// Plain (non-instanced) R3F meshes. At ~128 real-world pins this is still
// cheap enough that instancing would only add complexity for no real gain.
export function DestinationPins({
  items,
  selectedKey,
  hoveredKey,
  onHoverChange,
  onPinClick,
  pinColor,
  pinSelectedColor,
  hoverCardRef,
  containerSize,
}: DestinationPinsProps) {
  const pinnableItems = useMemo(() => items.filter(isPinnable), [items]);

  const nearestNeighborDistances = useMemo(
    () => computeNearestNeighborDistances(pinnableItems),
    [pinnableItems],
  );

  const hoveredItem = useMemo(
    () => pinnableItems.find((item) => item.key === hoveredKey) ?? null,
    [pinnableItems, hoveredKey],
  );

  return (
    <>
      {pinnableItems.map((item) => (
        <Pin
          key={item.key}
          item={item}
          isSelected={item.key === selectedKey}
          isHovered={item.key === hoveredKey}
          onHoverChange={onHoverChange}
          onPinClick={onPinClick}
          pinColor={pinColor}
          pinSelectedColor={pinSelectedColor}
          nearestNeighborDistance={nearestNeighborDistances.get(item.key) ?? Infinity}
        />
      ))}
      <HoverCardProjector hoveredItem={hoveredItem} hoverCardRef={hoverCardRef} containerSize={containerSize} />
    </>
  );
}

interface PinProps {
  item: PinnableItem;
  isSelected: boolean;
  isHovered: boolean;
  onHoverChange: (key: string | null) => void;
  onPinClick: (key: string) => void;
  pinColor: string;
  pinSelectedColor: string;
  nearestNeighborDistance: number;
}

function Pin({
  item,
  isSelected,
  isHovered,
  onHoverChange,
  onPinClick,
  pinColor,
  pinSelectedColor,
  nearestNeighborDistance,
}: PinProps) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const isHoveredRef = useRef(isHovered);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  // Reset the cursor on unmount if this pin currently owns the pointer hover.
  useEffect(() => {
    return () => {
      if (isHoveredRef.current) document.body.style.cursor = "auto";
    };
  }, []);

  const altitude = isSelected ? PIN_ALTITUDE_RADIUS_SELECTED : PIN_ALTITUDE_RADIUS;
  const position = useMemo(
    () => latLngToVector3(item.lat, item.lng, altitude),
    [item.lat, item.lng, altitude],
  );
  const quaternion = useMemo(() => {
    const normal = new Vector3(position.x, position.y, position.z).normalize();
    return new Quaternion().setFromUnitVectors(UP, normal);
  }, [position]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const facing = isFacingCamera(position, state.camera.position);
    if (group.visible !== facing) group.visible = facing;
    if (!facing && isHoveredRef.current) onHoverChange(null);

    // Keep a roughly constant on-screen size as the camera zooms in/out.
    const cameraDistance = state.camera.position.length();
    const rawScale = cameraDistance / SCALE_REFERENCE_DISTANCE;
    const scale = Math.min(MAX_PIN_SCALE, Math.max(MIN_PIN_SCALE, rawScale));
    group.scale.setScalar(scale);

    if (ringRef.current && isSelected) {
      const period = 1.6;
      const t = (state.clock.elapsedTime % period) / period;
      ringRef.current.scale.setScalar(1 + t * 1.6);
      const material = ringRef.current.material as MeshBasicMaterial;
      material.opacity = Math.max(0, 0.6 * (1 - t));
    }
  });

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
    onHoverChange(item.key);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = "auto";
    if (isHoveredRef.current) onHoverChange(null);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const down = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!down) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;

    // Touch: first tap previews (via the hover card), second tap opens
    // details. Mouse/pen: a click always opens details directly.
    const isTouch = event.pointerType === "touch";
    if (isTouch && !isHoveredRef.current) {
      onHoverChange(item.key);
      return;
    }
    onPinClick(item.key);
  };

  // Swallow the synthetic "click" event too, so it doesn't keep propagating
  // to the occluder sphere behind the pin (which treats clicks as
  // background clicks).
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
  };

  const coneRadius = isSelected ? 1.3 : 1;
  const coneHeight = isSelected ? 3.6 : 2.8;
  const renderOrder = isSelected ? 3 : 1;

  // Cap the hit sphere so overlapping neighbours in dense clusters (Greek
  // islands, Balearics, Canaries…) don't swallow each other's hit areas:
  // never more than ~3.5x the visible radius, and never past halfway to
  // the nearest neighbour pin. Floored so it stays comfortably clickable.
  const uncappedHitRadius = coneRadius * 3.5;
  const neighborCap = nearestNeighborDistance / 2;
  const hitRadius = Math.max(coneRadius * 1.5, Math.min(uncappedHitRadius, neighborCap));

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]} quaternion={quaternion}>
      <mesh renderOrder={renderOrder}>
        <coneGeometry args={[coneRadius, coneHeight, 12]} />
        <meshBasicMaterial color={isSelected ? pinSelectedColor : pinColor} depthTest={false} />
      </mesh>
      {isSelected && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={renderOrder}>
          <ringGeometry args={[1.6, 2, 32]} />
          <meshBasicMaterial
            color={pinSelectedColor}
            transparent
            opacity={0.6}
            side={DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}
      <mesh
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface HoverCardProjectorProps {
  hoveredItem: PinnableItem | null;
  hoverCardRef: RefObject<HTMLDivElement | null>;
  containerSize: { width: number; height: number };
}

// Projects the hovered pin's world position to screen space every frame and
// writes the result straight to the hover card's DOM ref — no React
// re-render per frame.
function HoverCardProjector({ hoveredItem, hoverCardRef, containerSize }: HoverCardProjectorProps) {
  const vector = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    const card = hoverCardRef.current;
    if (!card) return;

    if (!hoveredItem || containerSize.width === 0 || containerSize.height === 0) {
      card.style.opacity = "0";
      return;
    }

    const pos = latLngToVector3(hoveredItem.lat, hoveredItem.lng, PIN_ALTITUDE_RADIUS);
    const facing = isFacingCamera(pos, state.camera.position);
    if (!facing) {
      card.style.opacity = "0";
      return;
    }

    vector.set(pos.x, pos.y, pos.z).project(state.camera);

    const { width, height } = containerSize;
    const x = (vector.x * 0.5 + 0.5) * width;
    const y = (-vector.y * 0.5 + 0.5) * height;

    const cardWidth = card.offsetWidth || 256;
    const cardHeight = card.offsetHeight || 140;

    const clampedX = Math.min(Math.max(x - cardWidth / 2, 4), Math.max(width - cardWidth - 4, 4));
    const clampedY = Math.min(
      Math.max(y - HOVER_CARD_OFFSET_Y - cardHeight, 4),
      Math.max(height - cardHeight - 4, 4),
    );

    card.style.opacity = "1";
    card.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  });

  return null;
}
