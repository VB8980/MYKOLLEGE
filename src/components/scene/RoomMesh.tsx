// Комната: выдавленный полигон + контур + подпись. Клик — выбор цели.
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Edges } from '@react-three/drei';
import type { Room, Floor } from '../data/types';

interface Props {
  room: Room;
  floor: Floor;
  opacity: number;
  isRouteTarget?: boolean;
  onClick: (roomId: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  classroom: '#5eead4', lab: '#a78bfa', hall: '#93c5fd', corridor: '#475569',
  stairs: '#fbbf24', toilet: '#6ee7b7', wardrobe: '#f0abfc', entrance: '#38bdf8', other: '#64748b',
};

export const RoomMesh = React.memo(function RoomMesh({ room, floor, opacity, isRouteTarget, onClick }: Props) {
  // Shape в локальной плоскости XY, затем поворот -90° вокруг X => (x, y)->(x, -y)... 
  // Проще: строим shape в координатах (x, -z), потом geometry.rotateX(-PI/2) даёт корректное XZ-отображение.
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    room.polygon.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shape.closePath();
    const h = Math.min(2.8, floor.height - 0.4); // высота выдавливания ~2.5–3 м
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [room.polygon, floor.height]);

  const color = TYPE_COLORS[room.type] ?? '#64748b';
  const y = floor.level * floor.height;

  return (
    <group position={[0, y, 0]}>
      <mesh
        geometry={geometry}
        onClick={(e) => { e.stopPropagation(); onClick(room.id); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <meshToonMaterial
          color={color}
          transparent
          opacity={opacity * (isRouteTarget ? 1 : 0.55)}
          emissive={isRouteTarget ? color : '#000000'}
          emissiveIntensity={isRouteTarget ? 0.7 : 0}
        />
        <Edges threshold={15} color={isRouteTarget ? '#ffffff' : color} />
      </mesh>
      {/* Подпись комнаты */}
      {opacity > 0.35 && (
        <Text
          position={[room.labelPosition[0], 2.9, -room.labelPosition[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.4}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#0f172a"
        >
          {room.name}
        </Text>
      )}
    </group>
  );
});
