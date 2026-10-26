import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileLinkConflict, webLink } from '../app/lib/answers/profile-links.ts';

test('standard links require a destination even when the profile is empty or different', () => {
  assert.equal(profileLinkConflict('LinkedIn profile URL', 'https://linkedin.com/in/new', {linkedin:'https://linkedin.com/in/old'}), 'linkedin');
  assert.equal(profileLinkConflict('Your GitHub?', 'https://github.com/ada', {}), 'github');
  assert.equal(profileLinkConflict('Portfolio', 'https://ada.dev', {}), 'portfolio');
  assert.equal(profileLinkConflict('Your link', 'https://ada.dev/', {portfolio:'https://ada.dev'}), 'portfolio');
});
test('work samples and repositories stay question-specific, not profile updates', () => {
  assert.equal(profileLinkConflict('Share a project on GitHub', 'https://github.com/ada/project', {}), null);
  assert.equal(profileLinkConflict('Writing sample', 'https://ada.dev/article', {portfolio:'https://ada.dev'}), null);
  assert.equal(profileLinkConflict('Relevant work', 'https://github.com/ada/project', {}), null);
});
test('only a single web URL can be moved to the profile', () => {
  for (const value of ['javascript:alert(1)', 'https://user:password@example.com', 'Here is https://ada.dev', '']) assert.equal(webLink(value), null);
});
