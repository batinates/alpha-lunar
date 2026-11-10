import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

export function createLabelTexture(label: string, detail = '', active = false): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 72
  const context = canvas.getContext('2d')!
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = active ? 'rgba(231,185,108,.95)' : 'rgba(107,216,246,.62)'
  context.fillRect(4, 35, 34, 2)
  context.fillStyle = active ? '#f0c676' : '#b8c9d0'
  context.font = '500 23px Consolas, monospace'
  context.textBaseline = 'middle'
  context.fillText(label, 50, detail ? 27 : 36)
  if (detail) {
    context.fillStyle = active ? 'rgba(231,185,108,.65)' : 'rgba(115,139,149,.78)'
    context.font = '500 13px Consolas, monospace'
    context.fillText(detail, 50, 53)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  return texture
}
