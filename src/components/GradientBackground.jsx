import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

// Живой фон CRM (ShaderGradient, WebGL). Цвета — мягкие версии фирменных: голубой, персиковый, светлый.
// Грузится отдельным куском после интерфейса (React.lazy в GradientLayer), поэтому старт CRM не тормозит.
export default function GradientBackground() {
  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0 }}
      pixelDensity={1}            // фон размыт по смыслу — полная плотность пикселей только греет видеокарту
      fov={45}
      pointerEvents="none"
      lazyLoad={false}
      powerPreference="low-power"
    >
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate="on"
        uSpeed={0.12}
        uStrength={1.6}
        uDensity={1.1}
        uFrequency={5.5}
        uAmplitude={0}
        positionX={0} positionY={0} positionZ={0}
        rotationX={50} rotationY={0} rotationZ={-60}
        color1="#BFD6FF"
        color2="#FFE3CC"
        color3="#F1F3F7"
        reflection={0.1}
        cAzimuthAngle={180}
        cPolarAngle={80}
        cDistance={2.8}
        cameraZoom={9.1}
        lightType="3d"
        brightness={1.2}
        envPreset="city"
        grain="off"
      />
    </ShaderGradientCanvas>
  )
}
