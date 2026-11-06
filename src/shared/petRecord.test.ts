import { describe, expect, it } from 'vitest'
import { createPet, nameLength, parsePetRecord, sanitizeName } from './petRecord'

describe('pet names', () => {
  it('counts visible characters, so Thai marks do not use up the limit', () => {
    expect(nameLength('มะลิ')).toBe(3) // ม, ะ, ลิ
    expect(nameLength('ส้มจี๊ด')).toBe(4) // ส้, ม, จี๊, ด
    expect(nameLength('Mochi')).toBe(5)
  })

  it('trims, collapses spaces and enforces 1-20 characters', () => {
    expect(sanitizeName('  Mo   chi ')).toBe('Mo chi')
    expect(sanitizeName('   ')).toBeNull()
    expect(sanitizeName('x'.repeat(20))).toBe('x'.repeat(20))
    expect(sanitizeName('x'.repeat(21))).toBeNull()
    expect(sanitizeName(42)).toBeNull()
  })
})

describe('createPet', () => {
  it('starts at 80 / 80 with zero counters', () => {
    expect(createPet('มะลิ', 1_000)).toEqual({
      version: 1,
      name: 'มะลิ',
      species: 'cat',
      adoptedAt: 1_000,
      needs: { hunger: 80, happiness: 80 },
      updatedAt: 1_000,
      counters: { feeds: 0, pets: 0 },
      treats: 0
    })
  })

  it('rejects a bad name', () => {
    expect(() => createPet('', 0)).toThrow(/name/)
  })
})

describe('parsePetRecord', () => {
  const good = createPet('Mochi', 1_000)

  it('round-trips a stored record', () => {
    expect(parsePetRecord(JSON.parse(JSON.stringify(good)))).toEqual(good)
  })

  it('clamps needs and repairs counters', () => {
    const r = parsePetRecord({
      ...good,
      needs: { hunger: 150, happiness: -3 },
      counters: { feeds: -1 }
    })
    expect(r?.needs).toEqual({ hunger: 100, happiness: 0 })
    expect(r?.counters).toEqual({ feeds: 0, pets: 0 })
  })

  it('rejects records it cannot trust', () => {
    expect(parsePetRecord(null)).toBeNull()
    expect(parsePetRecord({ ...good, version: 2 })).toBeNull()
    expect(parsePetRecord({ ...good, name: '' })).toBeNull()
    expect(parsePetRecord({ ...good, species: 'dog' })).toBeNull()
    expect(parsePetRecord({ ...good, updatedAt: 'yesterday' })).toBeNull()
    expect(parsePetRecord({ ...good, needs: { hunger: 50 } })).toBeNull()
  })
})

describe('treat stock in pet.json (requirement-v4.md FR-53)', () => {
  const base = {
    version: 1,
    name: 'Mochi',
    species: 'cat',
    adoptedAt: 1,
    needs: { hunger: 50, happiness: 50 },
    updatedAt: 2
  }
  it('older files without treats read as 0; new pets start at 0', () => {
    expect(parsePetRecord(base)?.treats).toBe(0)
    expect(createPet('Mochi', 1).treats).toBe(0)
  })
  it('keeps a valid stock and caps a bad one', () => {
    expect(parsePetRecord({ ...base, treats: 3 })?.treats).toBe(3)
    expect(parsePetRecord({ ...base, treats: 99 })?.treats).toBe(5)
    expect(parsePetRecord({ ...base, treats: -2 })?.treats).toBe(0)
  })
})
