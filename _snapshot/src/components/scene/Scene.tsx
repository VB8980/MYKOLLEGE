// 3D-сцена: фон, свет, туман, слои кампуса и здания, маршрут, камера.
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useAppStore } from '../store/useAppStore';
import { CampusModel } from './CampusModel';
import { CampusModelCollege } from './CampusModelCollege';
import { IndoorLayers } from './IndoorLayers';
import { RouteLayer } from './RouteLayer';
import { CameraRig } from './CameraRig';

export function Scene() {
  const dark = useAppStore((s) => s.darkTheme);
  const viewMode = useAppStore((s) => s.viewMode);

  const bg = dark ? '#070b14' : '#dbe7f5';
  const fogColor = dark ? '#0a1220' : '#cfe0f4';

  return (
    <Canvas
      shadows
      camera={{ position: [220, 240, 460], fov: 50, near: 0.5, far: 4000 }}
      dpr={[1, 1.8]}
      style={{ background: bg }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, viewMode === 'campus' ? 320 : 60, viewMode === 'campus' ? 1400 : 320]} />

      {/* Свет: мягкий ключевой + холодный заполняющий + тёплый контровой */}
      <ambientLight intensity={dark ? 0.5 : 0.9} color={dark ? '#8ea6d8' : '#ffffff'} />
      <directionalLight position={[180, 320, 140]} intensity={1.15} color="#ffeacc" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-220, 160, -180]} intensity={0.4} color="#67e8f9" />

      {dark && viewMode === 'campus' && <Stars radius={900} depth={80} count={1600} factor={5} saturation={0} fade speed={0.6} />}

      {viewMode === 'campus' ? (
        <>
          <CampusModel />
          <CampusModelCollege />
        </>
      ) : (
        <IndoorLayers />
      )}

      <RouteLayer />

      {viewMode === 'indoor' && (
        <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={140} blur={2.2} far={12} resolution={512} color="#000000" />
      )}

      <CameraRig />

      {/* Постобработка аккуратно: лёгкий bloom для неона + виньетка */}
      <EffectComposer multisampling={2}>
        <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
