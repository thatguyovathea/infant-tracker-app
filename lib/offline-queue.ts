const QUEUE_KEY = "infant-tracker-offline-queue"

export type QueuedInsert = {
  id: string            // local UUID for idempotency
  queuedAt: string
  operation: "insert"
  table: "feeding_logs" | "diaper_logs" | "sleep_logs"
  data: Record<string, unknown>
  notification: QueuedNotification | null
}

export type QueuedUpdate = {
  id: string
  queuedAt: string
  operation: "update"
  table: "sleep_logs"
  rowId: string         // server-side row to update
  data: Record<string, unknown>
  notification: QueuedNotification | null
}

export type QueuedNotification = {
  family_id: string
  actor_id: string | undefined
  type: string
  title: string
  body: string
}

export type QueuedItem = QueuedInsert | QueuedUpdate

export function readQueue(): QueuedItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function enqueue(item: QueuedItem) {
  const queue = readQueue()
  queue.push(item)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function removeFromQueue(id: string) {
  const queue = readQueue().filter(i => i.id !== id)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}
