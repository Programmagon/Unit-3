import { useRef } from "react";

export default function Canvas() {
  const canvasRef = useRef(null);
  const ctx = useRef(null);

  const stateRef = useRef({
    viewport: { offsetX: 0, offsetY: 0, scale: 1.0 },
    cells: new Map(),
    mouse: {
      isDown: false
    }
  })

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}

      />
    </div>
  )
}