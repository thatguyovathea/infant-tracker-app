const KEY_PREFIX = "baby-photo-"

export function getBabyPhoto(babyId: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + babyId)
  } catch {
    return null
  }
}

export function saveBabyPhoto(babyId: string, dataUrl: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + babyId, dataUrl)
  } catch {
    // localStorage full or unavailable
  }
}

export function removeBabyPhoto(babyId: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + babyId)
  } catch {
    // ignore
  }
}

export function resizeAndSave(babyId: string, file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = 200
        canvas.height = 200
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("No canvas context")); return }

        // Center-crop: use the largest square from the center of the image
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200)

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
        saveBabyPhoto(babyId, dataUrl)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}
