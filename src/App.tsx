import { Canvas } from '@react-three/fiber';
import { CONFIG } from './lib/config';

/**
 * Корневой компонент приложения Campus Navigator 3D.
 *
 * Каркас (шаг 1): layout «панель управления слева + 3D-сцена справа».
 * Компоненты Scene/RouteLayer/палиты подключаются на шагах 6–8 —
 * здесь оставлены заглушки, чтобы приложение запускалось уже сейчас.
 */
export default function App() {
  return (
    <div className="h-full w-full flex bg-night text-gray-200 font-sans">
      {/* Левая панель навигации — наполняется на шаге 8 */}
      <aside className="w-[340px] shrink-0 h-full p-3 flex flex-col gap-3 border-r border-white/5 bg-panel/60 backdrop-blur-md z-10">
        <header className="panel p-4">
          <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">
            Campus Navigator <span className="text-neon">3D</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Пешеходная навигация по кампусу МИЭТ · улицы → здания → этажи
          </p>
        </header>

        <div className="panel p-4 flex-1 flex flex-col items-center justify-center text-center gap-2">
          <div className="text-4xl">🧭</div>
          <div className="text-sm font-semibold text-gray-300">Панель маршрута</div>
          <div className="text-xs text-gray-500">
            Выбор «откуда/куда», пошаговые подсказки и управление полётом камеры
            появятся на следующих шагах разработки.
          </div>
        </div>
      </aside>

      {/* Центральная 3D-сцена — наполняется на шагах 6–7 */}
      <main className="relative flex-1 h-full">
        <Canvas
          dpr={[1, CONFIG.scene.maxPixelRatio]}
          camera={{ position: [0, CONFIG.scene.defaultCameraY, 160], fov: 50, near: 0.1, far: 1200 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={[CONFIG.scene.skyColor]} />
          <fog attach="fog" args={[CONFIG.scene.skyColor, CONFIG.scene.fogNear, CONFIG.scene.fogFar]} />
          <ambientLight intensity={0.65} />
          <directionalLight position={[80, 120, 60]} intensity={0.9} />
          <gridHelper
            args={[CONFIG.scene.groundSize, CONFIG.scene.gridSubdivision, CONFIG.scene.gridColor, CONFIG.scene.gridColor]}
          />
          {/* TODO шаг 6: <Scene campus={demoCampus} /> */}
        </Canvas>

        <div className="absolute bottom-3 right-3 panel px-3 py-2 text-[11px] text-gray-400 pointer-events-none">
          Демо-режим сборки · каркас готов
        </div>
      </main>
    </div>
  );
}
