import test from 'node:test';
import assert from 'node:assert/strict';
import { joinApiBase } from './apiBase';

test('joinApiBase keeps relative API paths when no backend base is configured', () => {
  assert.equal(joinApiBase('', '/api/voice-hub/status'), '/api/voice-hub/status');
  assert.equal(joinApiBase('   ', 'api/voice-hub/status'), '/api/voice-hub/status');
});

test('joinApiBase combines the VPS base URL without duplicating slashes', () => {
  assert.equal(
    joinApiBase('https://reader-api.example.com/', '/api/voice-hub/tts'),
    'https://reader-api.example.com/api/voice-hub/tts'
  );
  assert.equal(
    joinApiBase('https://reader-api.example.com///', 'api/voice-hub/stt'),
    'https://reader-api.example.com/api/voice-hub/stt'
  );
});
