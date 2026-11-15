import type { MoonAction } from './moonAi'

export type MoonTurn = {
  id: string
  question: string
  answer: string
  actions: MoonAction[]
}

export type MoonChat = {
  id: string
  title: string
  updatedAt: number
  turns: MoonTurn[]
}

const storeName = 'conversations'
let connection: Promise<IDBDatabase> | undefined

function database() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('alpha-lunar-moon-ai', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        connection = undefined
      }
      resolve(db)
    }
  }).catch(error => {
    connection = undefined
    throw error
  })
  return connection
}

export function updateMoonChat(chat: MoonChat, turn: MoonTurn, updatedAt: number): MoonChat {
  const existing = chat.turns.some(item => item.id === turn.id)
  const turns = existing ? chat.turns.map(item => item.id === turn.id ? turn : item) : [...chat.turns, turn]
  return { ...chat, updatedAt, turns }
}

export async function readMoonChats(): Promise<MoonChat[]> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve((request.result as MoonChat[]).sort((a, b) => b.updatedAt - a.updatedAt))
    request.onerror = () => reject(request.error)
  })
}

export async function saveMoonTurn(chat: MoonChat, turn: MoonTurn, updatedAt: number) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const previous = store.get(chat.id)
    previous.onsuccess = () => store.put(updateMoonChat(previous.result ?? chat, turn, updatedAt))
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
}
