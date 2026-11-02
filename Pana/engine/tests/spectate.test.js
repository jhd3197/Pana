import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleTarget, nextLiving, createSpectator, createSpectateCamera, createPose, followPose, overheadPose } from '../play/spectate.js';

test('cycling wraps both ways and starts at an end when the current one is gone', () => {
  const ids = [3, 5, 8];
  assert.equal(cycleTarget(ids, 3, 1), 5);
  assert.equal(cycleTarget(ids, 8, 1), 3);
  assert.equal(cycleTarget(ids, 3, -1), 8);
  assert.equal(cycleTarget(ids, 9, 1), 3);
  assert.equal(cycleTarget(ids, 9, -1), 8);
  assert.equal(cycleTarget([], 3, 1), null);
  assert.equal(cycleTarget([4], 4, 1), 4);
});

test('a target that goes down hands over to the next one in the old order', () => {
  assert.equal(nextLiving([3, 5, 8], [3, 8], 5), 8);
  assert.equal(nextLiving([3, 5, 8], [3], 8), 3);
  assert.equal(nextLiving([3, 5, 8], [5], 5), 5);
  assert.equal(nextLiving([3, 5], [], 5), null);
});

test('down: killcam on the killer, then watching; up again: off', () => {
  const s = createSpectator({ killcam: 1.5 }), targets = [2, 3, 4];
  assert.equal(s.update(.1, { down: false, targets }), 'off');
  assert.equal(s.shot, 'off');
  assert.equal(s.update(.1, { down: true, killer: 3, targets }), 'killcam');
  assert.equal(s.target, 3); assert.equal(s.killer, 3);
  s.update(1, { down: true, killer: 9, targets });
  assert.equal(s.mode, 'killcam'); assert.equal(s.killer, 3, 'the killer is read once');
  assert.equal(s.update(.6, { down: true, targets }), 'watch');
  assert.equal(s.shot, 'follow');
  assert.equal(s.next(), 4); assert.equal(s.next(), 2); assert.equal(s.prev(), 4);
  assert.equal(s.toggle(), 'overhead'); assert.equal(s.shot, 'overhead');
  assert.equal(s.next(), 4, 'next from the overhead follows the same pana again'); assert.equal(s.shot, 'follow');
  s.toggle(); assert.equal(s.prev(), 3, 'previous from the overhead steps back'); s.toggle();
  assert.equal(s.update(.1, { down: false, targets }), 'off');
  assert.equal(s.target, null); assert.equal(s.shot, 'off');
  s.update(.1, { down: true, killer: null, targets });
  assert.equal(s.target, 2, 'no killer: the first living pana');
  assert.equal(s.view, 'overhead', 'the view choice stays for the next time');
});

test('a press during the killcam skips to watching; nobody left means overhead', () => {
  const s = createSpectator(), targets = [2, 3];
  s.update(.1, { down: true, killer: 2, targets });
  assert.equal(s.mode, 'killcam');
  assert.equal(s.next(), 3); assert.equal(s.mode, 'watch');
  targets.length = 0;
  s.update(.1, { down: true, targets });
  assert.equal(s.target, null); assert.equal(s.shot, 'overhead');
  targets.push(7); s.update(.1, { down: true, targets });
  assert.equal(s.target, 7); assert.equal(s.shot, 'follow');
});

test('the follow pose stops short of cover and never goes past it', () => {
  const pose = createPose(), head = { x: 0, y: 1.5, z: 0 };
  followPose(pose, head, { x: 0, z: -2 });
  assert.ok(pose.pos.z > 3, 'behind the pana, opposite the aim');
  assert.ok(pose.look.z < 0, 'looking where they aim');
  // A wall 1 m behind: the camera stays in front of it.
  followPose(pose, head, { x: 0, z: -1 }, { clip: () => 1, margin: .3 });
  assert.ok(Math.hypot(pose.pos.x - head.x, pose.pos.y - head.y, pose.pos.z - head.z) <= .7 + 1e-9);
  followPose(pose, head, { x: 0, z: -1 }, { clip: () => 0 });
  assert.deepEqual(pose.pos, head, 'no room at all: at the head');
});

test('the overhead fits the court and the rig eases toward each pose without allocating poses', () => {
  const pose = createPose();
  overheadPose(pose, { x: 30, z: 20 }, 60, 16 / 9, { tilt: 0, pad: 1 });
  assert.ok(Math.abs(pose.pos.y - 20 / Math.tan(Math.PI / 6)) < 1e-6);
  overheadPose(pose, { x: 30, z: 20 }, 60, .5, { tilt: 0, pad: 1 });
  assert.ok(Math.abs(pose.pos.y - 60 / Math.tan(Math.PI / 6)) < 1e-6, 'a narrow screen fits the width');
  assert.equal(overheadPose(createPose(), { x: 30, z: 20 }, 60, .5, { max: 50 }).pos.y, 50, 'capped');
  const rig = createSpectateCamera({ rate: 4 });
  rig.start(0, 1.5, 0, 0, 1.5, -5);
  const before = rig.distance(pose);
  rig.step(.1, pose);
  assert.ok(rig.distance(pose) < before, 'closer after a step');
  assert.ok(rig.pos.y > 1.5);
  for (let i = 0; i < 200; i++) rig.step(.05, pose);
  assert.ok(rig.distance(pose) < .01, 'settles on the pose');
  assert.equal(pose.pos.y, 60 / Math.tan(Math.PI / 6) * 1, 'the arc never changes the pose it was given');
  rig.step(.05, followPose(pose, { x: 10, y: 1.5, z: 0 }, { x: 1, z: 0 }), { snap: true });
  assert.equal(rig.distance(pose), 0);
});
