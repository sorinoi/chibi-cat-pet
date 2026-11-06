import { describe, expect, it } from 'vitest'
import { LANGUAGES, isLanguage, languageForLocales, stringsFor } from './strings'

/** Every leaf path with its kind ("string" or "function"), e.g. "tray.feed:string". */
function shape(value: unknown, prefix = ''): string[] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      shape(child, prefix ? `${prefix}.${key}` : key)
    )
  }
  return [`${prefix}:${typeof value}`]
}

describe('string tables (FR-43, NFR-20)', () => {
  it('every language has exactly the keys and kinds of English', () => {
    const en = shape(stringsFor('en')).sort()
    for (const language of LANGUAGES) {
      expect(shape(stringsFor(language)).sort()).toEqual(en)
    }
  })

  it('has no empty texts', () => {
    for (const language of LANGUAGES) {
      const table = stringsFor(language) as unknown as Record<string, unknown>
      const walk = (value: unknown): void => {
        if (typeof value === 'string') expect(value.trim()).not.toBe('')
        else if (typeof value === 'function') expect(String(value(3, 20)).trim()).not.toBe('')
        else if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk)
      }
      walk(table)
    }
  })

  it('formats with arguments in both languages', () => {
    expect(stringsFor('en').about.detail('3.0.0')).toContain('3.0.0')
    expect(stringsFor('th').about.detail('3.0.0')).toContain('3.0.0')
    expect(stringsFor('th').settings.nameInvalid(20)).toContain('20')
  })
})

describe('language choice (FR-42)', () => {
  it('picks Thai only when the first preferred locale is Thai', () => {
    expect(languageForLocales(['th-TH', 'en-US'])).toBe('th')
    expect(languageForLocales(['th'])).toBe('th')
    expect(languageForLocales(['en-US', 'th-TH'])).toBe('en')
    expect(languageForLocales(['the'])).toBe('en')
    expect(languageForLocales([])).toBe('en')
  })

  it('recognizes only supported languages', () => {
    expect(isLanguage('th')).toBe(true)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})
