import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

// Живой фон CRM (ShaderGradient, WebGL). Цвета — мягкие голубые тона фирменного синего.
// Грузится отдельным куском после интерфейса (React.lazy в GradientLayer), поэтому старт CRM не тормозит.
// colors — три цвета волны; по умолчанию мягкий фон CRM, для карточек передаются свои.
export default function GradientBackground({ colors = ['#B7D0FF', '#D9E8FF', '#EEF4FF'], speed = 0.12 }) {
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
        uSpeed={speed}
        uStrength={1.6}
        uDensity={1.1}
        uFrequency={5.5}
        uAmplitude={0}
        positionX={0} positionY={0} positionZ={0}
        rotationX={50} rotationY={0} rotationZ={-60}
        color1={colors[0]}
        color2={colors[1]}
        color3={colors[2]}
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
