import { describe, expect, it } from 'bun:test'
import {
  formatCoAuthorTrailer,
  parseCoAuthor,
  stripMatchingQuotes,
  USAGE,
} from './commit-message.js'

describe('commit-message command helpers', () => {
  it('parses quoted co-author names with a plain email', () => {
    expect(parseCoAuthor('"GPT 5.5" noreply@quantum.dev')).toEqual({
      name: 'GPT 5.5',
      email: 'noreply@quantum.dev',
    })
  })

  it('parses co-author trailers with angle-bracket emails', () => {
    expect(parseCoAuthor('Quantum (gpt-5.5) <noreply@quantum.dev>')).toEqual(
      {
        name: 'Quantum (gpt-5.5)',
        email: 'noreply@quantum.dev',
      },
    )
  })

  it('rejects co-author trailers with empty sanitized names', () => {
    expect(parseCoAuthor('"  " noreply@quantum.dev')).toBeNull()
    expect(parseCoAuthor('"  " <noreply@quantum.dev>')).toBeNull()
  })

  it('strips one pair of matching quotes from custom attribution text', () => {
    expect(stripMatchingQuotes('"Generated with Quantum"')).toBe(
      'Generated with Quantum',
    )
    expect(stripMatchingQuotes("'Generated with Quantum'")).toBe(
      'Generated with Quantum',
    )
    expect(stripMatchingQuotes('"Generated with Quantum')).toBe(
      '"Generated with Quantum',
    )
  })

  it('formats a sanitized co-author trailer', () => {
    expect(
      formatCoAuthorTrailer('Quantum <gpt>\n', '<noreply@quantum.dev>'),
    ).toBe('Co-Authored-By: Quantum gpt <noreply@quantum.dev>')
  })

  it('makes set scope explicit with example text', () => {
    expect(USAGE).toContain(
      'Controls only the attribution text appended after /commit messages.',
    )
    expect(USAGE).toContain(
      '/commit-message set "Generated with Quantum using GPT-5.5"',
    )
    expect(USAGE).not.toContain('/commit-message set-attribution')
  })
})
