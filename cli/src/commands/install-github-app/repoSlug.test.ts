import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('SuryanshuNabheet/quantum'), 'SuryanshuNabheet/quantum')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/SuryanshuNabheet/quantum'),
    'SuryanshuNabheet/quantum',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/SuryanshuNabheet/quantum.git'),
    'SuryanshuNabheet/quantum',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:SuryanshuNabheet/quantum.git'),
    'SuryanshuNabheet/quantum',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/SuryanshuNabheet/quantum'),
    'SuryanshuNabheet/quantum',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/SuryanshuNabheet/quantum'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/SuryanshuNabheet'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/SuryanshuNabheet/quantum'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/SuryanshuNabheet/quantum'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/SuryanshuNabheet/quantum'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/SuryanshuNabheet/quantum'),
    null,
  )
})
