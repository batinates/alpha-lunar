import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createMoonTexture(size = 1536): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size / 2
  const context = canvas.getContext('2d')!
  const random = mulberry32(20261111)

  const image = context.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4
      const large = Math.sin(x * 0.021) * 5 + Math.cos(y * 0.028) * 6 + Math.sin((x + y) * 0.008) * 8
      const grain = (random() - 0.5) * 26
      const base = 126 + large + grain
      image.data[i] = base * 0.91
      image.data[i + 1] = base * 0.94
      image.data[i + 2] = base
      image.data[i + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const maria = [
    [0.46, 0.38, 0.12, 0.09, -0.2], [0.39, 0.46, 0.09, 0.13, 0.4], [0.57, 0.32, 0.08, 0.06, 0.1],
    [0.34, 0.32, 0.055, 0.04, -0.1], [0.26, 0.48, 0.11, 0.16, 0.25], [0.67, 0.54, 0.08, 0.05, -0.3],
  ]
  for (const [cx, cy, rx, ry, rot] of maria) {
    context.save()
    context.translate(cx * canvas.width, cy * canvas.height)
    context.rotate(rot)
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, rx * canvas.width)
    gradient.addColorStop(0, 'rgba(29,34,39,.58)')
    gradient.addColorStop(0.72, 'rgba(38,42,45,.48)')
    gradient.addColorStop(1, 'rgba(45,48,51,0)')
    context.fillStyle = gradient
    context.scale(1, (ry * canvas.height) / (rx * canvas.width))
    context.beginPath()
    context.arc(0, 0, rx * canvas.width, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  for (let i = 0; i < 560; i += 1) {
    const x = random() * canvas.width
    const y = random() * canvas.height
    const radius = Math.pow(random(), 3) * 25 + 1
    const ellipseY = radius * (0.5 + Math.abs(Math.sin((y / canvas.height) * Math.PI)) * 0.5)
    context.save()
    context.translate(x, y)
    context.scale(1, ellipseY / radius)
    const crater = context.createRadialGradient(-radius * 0.18, -radius * 0.22, radius * 0.08, 0, 0, radius)
    crater.addColorStop(0, 'rgba(20,23,26,.75)')
    crater.addColorStop(0.63, 'rgba(50,54,57,.45)')
    crater.addColorStop(0.77, 'rgba(208,210,206,.48)')
    crater.addColorStop(1, 'rgba(100,104,105,0)')
    context.fillStyle = crater
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.anisotropy = 8
  return texture
}
