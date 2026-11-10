// Слой маршрута: светящаяся линия с анимацией "прорисовки", маркеры старта/финиша,
// указатель текущей позиции камеры.
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../store/useAppStore';
import { buildCameraPath } from '../lib/cameraPath';
import { prepareRouteForDisplay } from '../lib/routeTransform';

export function RouteLayer() {
  const route = useAppStore((s) => s.route);
  const viewMode = useAppStore((s) => s.viewMode);
  const progress = useAppStore((s) => s.animProgress);
  const arrived = useAppStore((s) => s.arrived);
  const animState = useAppStore((s) => s.animState);

  const pts = useMemo(() => (route ? prepareRouteForDisplay(route, viewMode) : []), [route, viewMode]);
  const path = useMemo(() => (pts.length >= 2 ? buildCameraPath(pts) : null), [pts]);

  // Полная линия (тусклая подложка) + активная часть (яркая, растёт с прогрессом)
  const fullPoints = useMemo(() => (path ? path.curve.getPoints(160) : []), [path]);
  const activePoints = useMemo(() => {
    if (!path || progress <= 0) return [];
    const n = Math.max(2, Math.floor(progress * 160));
    return path.curve.getPoints(160).slice(0, n + 1);
  }, [path, progress]);

  const markerRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!markerRef.current || !path) return;
    const p = path.at(progress);
    markerRef.current.position.copy(p);
    // пульсация финишного маркера при прибытии
    const s = arrived ? 1 + Math.sin(clock.elapsedTime * 5) * 0.25 : 1;
    markerRef.current.scale.setScalar(s);
  });

  if (!route || pts.length < 2 || !path) return null;

  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <group>
      {/* Подложка маршрута */}
      <Line points={fullPoints.map((v) => [v.x, v.y + 0.12, v.z] as [number, number, number])} color="#22d3ee" lineWidth={2} transparent opacity={0.25} />
      {/* Активная прорисованная часть — светящаяся */}
      {activePoints.length > 1 && (
        <>
          <Line points={activePoints.map((v) => [v.x, v.y + 0.12, v.z] as [number, number, number])} color="#67e8f9" lineWidth={5} transparent opacity={0.9} />
          <Line points={activePoints.map((v) => [v.x, v.y + 0.12, v.z] as [number, number, number])} color="#ffffff" lineWidth={1.6} />
        </>
      )}

      {/* Старт — зелёный маркер */}
      <group position={[start.x, start.y + 0.4, start.z]}>
        <mesh>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial color="#34d399" toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
          <ringGeometry args={[0.9, 1.2, 32]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>

      {/* Финиш — красный/синий маркер, пульсирует при прибытии */}
      <group ref={markerRef} position={[end.x, end.y + 0.4, end.z]}>
        <mesh position={[0, 1.2, 0]}>
          <coneGeometry args={[0.55, 1.4, 16]} />
          <meshBasicMaterial color="#f87171" toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.2, 32]} />
          <meshBasicMaterial color="#f87171" transparent opacity={0.6} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>

      {/* Текущий движущийся индикатор при анимации */}
      {(animState === 'playing') && <MovingDot path={path} />}

      {arrived && (
        <Html position={[end.x, end.y + 3.4, end.z]} center distanceFactor={60}>
          <div className="px-4 py-2 rounded-xl bg-emerald-500/90 text-white font-semibold shadow-lg whitespace-nowrap animate-pulse">
            🎯 Вы прибыли! {route.steps[route.steps.length - 1]?.text.replace(/^Вы прибыли: /, '') ?? ''}
          </div>
        </Html>
      )}
    </group>
  );
}

function MovingDot({ path }: { path: ReturnType<typeof buildCameraPath> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = useAppStore.getState().animProgress;
    ref.current.position.copy(path.at(t)).add(new THREE.Vector3(0, 0.5, 0));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.45, 12, 12]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
  );
}
