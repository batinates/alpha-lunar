import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import words from './tr.json'

type Language = 'en' | 'tr'
const translations: Record<string, string> = words
const storageKey = 'alpha-lunar.language'
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'en', setLanguage: () => {} })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem(storageKey) === 'tr' ? 'tr' : 'en' } catch { return 'en' }
  })
  useEffect(() => {
    document.documentElement.lang = language
    document.title = language === 'tr' ? 'ALPHA LUNAR — Ay Görev Analizi' : 'ALPHA LUNAR — Lunar Mission Intelligence'
    try { localStorage.setItem(storageKey, language) } catch { /* storage may be disabled */ }
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  return { ...context, t: (text: string) => context.language === 'tr' ? translations[text] ?? text : text }
}
