// Слои этажей внутреннего здания с учётом настроек прозрачности/изоляции.
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { FloorMesh } from './FloorMesh';
import { demoCampus } from '../data/demoCampus';

export function IndoorLayers() {
  const buildingId = useAppStore((s) => s.buildingId);
  const floorId = useAppStore((s) => s.floorId);
  const showAllFloors = useAppStore((s) => s.showAllFloors);
  const isolateFloor = useAppStore((s) => s.isolateFloor);
  const route = useAppStore((s) => s.route);

  const building = demoCampus.buildings.find((b) => b.id === buildingId) ?? demoCampus.buildings[0];
  const routeFloors = new Set(route?.floorsInvolved ?? []);

  return (
    <group>
      {building.floors.map((f) => {
        const isActive = f.id === floorId;
        let opacity: number;
        if (isolateFloor && !isActive) return null; // изоляция текущего этажа
        if (isActive) opacity = 1;
        else if (showAllFloors) opacity = routeFloors.has(f.id) ? 0.5 : 0.22; // полупрозрачные неактивные
        else return null;
        return (
          <FloorMesh
            key={f.id}
            building={building}
            floor={f}
            opacity={opacity}
            interactive={isActive}
          />
        );
      })}
      {/* Основание здания */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -10]}>
        <planeGeometry args={[90, 80]} />
        <meshToonMaterial color="#131c2e" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
