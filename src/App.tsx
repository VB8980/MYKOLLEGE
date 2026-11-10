import { Scene } from './components/Scene';

/**
 * Корневой компонент Campus Navigator 3D.
 * Каркас шага 1 (панель‑заглушка + пустой Canvas) заменён на полноценную сцену:
 * Scene сама рисует корпуса, маршрут, полёт камеры и кнопки управления.
 * Боковые панели поиска/шагов подключаются на шаге 8.
 */
export default function App() {
  return (
    <div className="fixed inset-0 bg-[#0a0a0f] text-gray-200 font-sans">
      <Scene />
    </div>
  );
}