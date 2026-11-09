// Уличный слой кампуса МИЭТ: стилизованные здания, дороги, газоны, деревья, дорожки графа.
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line, Edges } from '@react-three/drei';
import { getOutdoorData, buildingEntranceNode, type OutdoorBuilding } from '../data/campusOutdoor';
import { useAppStore } from '../store/useAppStore';
import { COLLEGE_WORLD_OFFSET } from '../lib/router';
import { INDOOR_SCALE } from '../lib/routeTransform';

const FH = 3.2;

// Псевдослучайные позиции деревьев (детерминированные)
function trees(seed: number, count: number): [number, number][] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const x = -380 + rnd() * 700;
    const z = -420 + rnd() * 800;
    // не ставим деревья на зданиях/дорогах — грубая проверка по прямоугольникам
    if (Math.abs(x) < 90 && Math.abs(z) < 70) continue;
    out.push([x, z]);
  }
  return out;
}

function BuildingBlock({ b }: { b: OutdoorBuilding }) {
  const [w, d] = b.size;
  const h = b.floors * FH;
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setTo = useAppStore((s) => s.setTo);
  const computeRoute = useAppStore((s) => s.computeRoute);

  // Цвет под стиль: главный корпус — кирпичный, остальные — пастельные
  const color =
    b.id === 'b1' ? '#b45f4a' :
    b.id === 'b2' ? '#c9a26b' :
    b.id === 'b5' ? '#7aa2c9' :
    b.id === 'b6' ? '#8b8fa3' :
    b.id === 'b8' ? '#6fbf9a' :
    ['#7d8fae', '#9a7db0', '#70a9a0'][b.id.charCodeAt(2) % 3];

  const onClick = () => {
    // Клик по зданию: если есть внутренняя схема — открыть её, иначе выбрать вход как цель
    if (b.id === 'b8') {
      setViewMode('indoor');
      setTo({ kind: 'node', id: 'entrance', buildingId: 'college', name: 'Главный вход демо-корпуса' });
      if (useAppStore.getState().from) computeRoute();
    } else {
      const nid = buildingEntranceNode[b.id];
      if (nid) {
        setTo({ kind: 'outdoor', id: nid, name: b.name });
        if (useAppStore.getState().from) computeRoute();
      }
    }
  };

  return (
    <group position={[b.center[0], 0, b.center[1]]}>
      {b.floors > 0 && (
        <mesh position={[0, h / 2, 0]} onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => (document.body.style.cursor = 'default')}>
          <boxGeometry args={[w, h, d]} />
          <meshToonMaterial color={color} transparent opacity={0.92} />
          <Edges threshold={15} color="#e2e8f0" />
        </mesh>
      )}
      {/* Белая башня-доминанта у главного входа корпуса 1 */}
      {b.id === 'b1' && (
        <group position={[45, 0, -d / 2 - 6]}>
          <mesh position={[0, 11, 0]}>
            <boxGeometry args={[16, 22, 14]} />
            <meshToonMaterial color="#f1f5f9" />
            <Edges color="#cbd5e1" />
          </mesh>
          <mesh position={[0, 23.5, 0]}>
            <coneGeometry args={[11, 5, 4]} />
            <meshToonMaterial color="#e2e8f0" />
          </mesh>
        </group>
      )}
      {/* Стадион — зелёный овал */}
      {b.id === 'stadium' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
            <circleGeometry args={[75, 48]} />
            <meshToonMaterial color="#2f7d4f" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
            <ringGeometry args={[58, 71, 48]} />
            <meshToonMaterial color="#c2410c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
            <circleGeometry args={[52, 48]} />
            <meshToonMaterial color="#3a9d63" />
          </mesh>
        </>
      )}
      {/* Площадь Шокина — светлая площадка */}
      {b.id === 'b2' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-90, 0.1, 5]}>
          <planeGeometry args={[130, 90]} />
          <meshToonMaterial color="#3b4252" />
        </mesh>
      )}
      {/* Подпись здания */}
      <Text
        position={[0, (b.floors > 0 ? h : 6) + 4, 0]}
        fontSize={7}
        color="#e2e8f0"
        anchorX="center"
        outlineWidth={0.3}
        outlineColor="#0f172a"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {b.name.split('—')[0].trim()}
      </Text>
      {b.address && (
        <Text position={[0, (b.floors > 0 ? h : 6) + 4, 12]} fontSize={3.6} color="#94a3b8" anchorX="center" rotation={[-Math.PI / 2, 0, 0]}>
          {b.address}
        </Text>
      )}
    </group>
  );
}

export function CampusModel() {
  const data = useMemo(() => getOutdoorData(), []);
  const showGraph = useAppStore((s) => s.showGraph);
  const treeSpots = useMemo(() => trees(42, 120), []);

  return (
    <group>
      {/* Земля */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -20]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshToonMaterial color="#12241a" />
      </mesh>

      {/* Газоны вокруг корпусов */}
      {[[-45, 105], [-135, -55], [-40, 175], [-255, 225]].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]}>
          <planeGeometry args={[170, 140]} />
          <meshToonMaterial color="#1c3a28" />
        </mesh>
      ))}

      {/* Солнечная аллея — широкая диагональная лента в нижней части */}
      <mesh rotation={[-Math.PI / 2, 0, -0.5]} position={[-120, 0.06, 265]}>
        <planeGeometry args={[560, 26]} />
        <meshToonMaterial color="#2b2f3a" />
      </mesh>
      {/* Разметка аллеи */}
      <Line points={[[-380, 0.12, 380], [140, 0.12, 130]]} color="#fbbf24" lineWidth={1.5} dashed dashSize={8} gapSize={6} />

      {/* Центральный проспект — вертикальная лента справа */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[345, 0.06, -20]}>
        <planeGeometry args={[26, 720]} />
        <meshToonMaterial color="#2b2f3a" />
      </mesh>
      <Line points={[[345, 0.12, -380], [345, 0.12, 340]]} color="#fbbf24" lineWidth={1.5} dashed dashSize={8} gapSize={6} />

      {/* Пешеходные дорожки — пунктирные светящиеся линии между рёбрами графа */}
      {data.edges.map(([from, to], i) => {
        const a = data.nodes.find((n) => n.id === from)!;
        const b = data.nodes.find((n) => n.id === to)!;
        return (
          <Line
            key={i}
            points={[[a.pos[0], 0.14, a.pos[1]], [b.pos[0], 0.14, b.pos[1]]]}
            color="#38bdf8"
            lineWidth={2.2}
            dashed
            dashSize={3}
            gapSize={2}
            transparent
            opacity={0.55}
          />
        );
      })}

      {/* Узлы уличного графа (отладка) */}
      {showGraph && data.nodes.map((n) => (
        <group key={n.id} position={[n.pos[0], 0.5, n.pos[1]]}>
          <mesh><sphereGeometry args={[1.6, 10, 10]} /><meshBasicMaterial color="#f472b6" /></mesh>
          <Text position={[0, 4, 0]} fontSize={3} color="#f9a8d4" anchorX="center">{n.id}</Text>
        </group>
      ))}

      {/* Маркеры входов зданий */}
      {data.buildings.filter((b) => b.id !== 'stadium').map((b) => {
        const nid = buildingEntranceNode[b.id];
        const n = data.nodes.find((x) => x.id === nid);
        if (!n) return null;
        return (
          <group key={b.id} position={[n.pos[0], 0, n.pos[1]]}>
            <mesh position={[0, 2, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
              <meshToonMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, 4.6, 0]}>
              <sphereGeometry args={[1, 12, 12]} />
              <meshBasicMaterial color="#7dd3fc" toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* Деревья — низкополигональные */}
      {treeSpots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.35, 0.5, 3.2, 6]} />
            <meshToonMaterial color="#5b4636" />
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <coneGeometry args={[2.4, 5, 7]} />
            <meshToonMaterial color="#2e6b45" />
          </mesh>
        </group>
      ))}

      {/* Внутренняя демо-схема колледжа — уменьшенная модель у корпуса b8 (в режиме Кампус) */}
      <group position={[COLLEGE_WORLD_OFFSET[0], 0, COLLEGE_WORLD_OFFSET[1]]} scale={[INDOOR_SCALE, 1, INDOOR_SCALE]} visible={false}>
        {/* скрытый якорь: сами этажи рисуются CampusModel через IndoorLayers при needIndoorInCampus */}
      </group>
    </group>
  );
}
