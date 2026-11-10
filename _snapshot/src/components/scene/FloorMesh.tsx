// Этаж: плиты комнат + граф навигации + двери + POI
import React from 'react';
import { Line, Html } from '@react-three/drei';
import type { Building, Floor } from '../data/types';
import { RoomMesh } from './RoomMesh';
import { useAppStore } from '../store/useAppStore';

interface Props {
  building: Building;
  floor: Floor;
  opacity: number;
  interactive: boolean;
}

export function FloorMesh({ building, floor, opacity, interactive }: Props) {
  const showGraph = useAppStore((s) => s.showGraph);
  const route = useAppStore((s) => s.route);
  const setTo = useAppStore((s) => s.setTo);
  const computeRoute = useAppStore((s) => s.computeRoute);
  const rooms = building.rooms.filter((r) => r.floorId === floor.id);
  const nodes = building.nodes.filter((n) => n.floorId === floor.id);
  const nodeById = new Map(building.nodes.map((n) => [n.id, n]));
  const doors = building.doors.filter((d) => d.floorId === floor.id);
  const y = floor.level * building.floorHeight;

  const onRoomClick = (roomId: string) => {
    if (!interactive) return;
    setTo({ kind: 'room', id: roomId, buildingId: building.id, name: building.rooms.find((r) => r.id === roomId)?.name ?? roomId });
    if (useAppStore.getState().from) computeRoute();
  };

  return (
    <group>
      {rooms.map((r) => (
        <RoomMesh
          key={r.id}
          room={r}
          floor={floor}
          opacity={opacity}
          isRouteTarget={route?.steps.some(() => false) /* placeholder */ && false}
          onClick={onRoomClick}
        />
      ))}

      {/* Двери — заметные маркеры */}
      {doors.map((d) => {
        const highlighted = route?.targetDoorId === d.id;
        return (
          <group key={d.id} position={[d.position[0], y + 1.05, -d.position[1]]}>
            <mesh rotation={[0, 0, 0]}>
              <boxGeometry args={[1.4, 2.1, 0.18]} />
              <meshToonMaterial color={highlighted ? '#f472b6' : '#fca5a5'} transparent opacity={Math.max(opacity, 0.35)} />
              {highlighted && <Edges color="#ffffff" />}
            </mesh>
            {highlighted && (
              <pointLight color="#f472b6" intensity={18} distance={12} />
            )}
          </group>
        );
      })}

      {/* POI и узлы (в отладочном режиме — весь граф) */}
      {showGraph && (
        <>
          {nodes.map((n) => (
            <mesh key={n.id} position={[n.pos[0], y + 0.3, -n.pos[1]]}>
              <sphereGeometry args={[0.35, 10, 10]} />
              <meshBasicMaterial color={n.type === 'stairs' ? '#fbbf24' : n.type === 'entrance' ? '#38bdf8' : '#22d3ee'} />
            </mesh>
          ))}
          {building.edges
            .filter((e) => nodeById.get(e.from)?.floorId === floor.id || nodeById.get(e.to)?.floorId === floor.id)
            .map((e, i) => {
              const a = nodeById.get(e.from), b = nodeById.get(e.to);
              if (!a || !b) return null;
              const ay = (nodeFloorLevel(building, a.floorId) ?? 0) * building.floorHeight + 0.3;
              const by = (nodeFloorLevel(building, b.floorId) ?? 0) * building.floorHeight + 0.3;
              return (
                <Line
                  key={`${e.from}-${e.to}-${i}`}
                  points={[[a.pos[0], ay, -a.pos[1]], [b.pos[0], by, -b.pos[1]]]}
                  color={e.type === 'stairs' ? '#fbbf24' : e.type === 'door' ? '#f472b6' : '#334155'}
                  lineWidth={1.5}
                  dashed
                  dashSize={0.6}
                  gapSize={0.4}
                />
              );
            })}
        </>
      )}

      {/* Лестница: визуальные ступени */}
      {rooms.filter((r) => r.type === 'stairs').map((r) => {
        const cx = r.labelPosition[0], cz = -r.labelPosition[1];
        return (
          <group key={`st-${r.id}`} position={[cx, y, cz]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <mesh key={i} position={[0, 0.2 + i * 0.32, -2.6 + i * 0.62]}>
                <boxGeometry args={[4.5, 0.25, 0.6]} />
                <meshToonMaterial color="#fcd34d" transparent opacity={Math.max(opacity, 0.4)} />
              </mesh>
            ))}
            <Html position={[0, 3.4, 0]} center distanceFactor={40}>
              <div className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs whitespace-nowrap">
                ↑ Лестница
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function nodeFloorLevel(b: Building, floorId: string): number | undefined {
  return b.floors.find((f) => f.id === floorId)?.level;
}
