import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVerificationPlan, verificationPlans } from './verification-plans.ts'

test('manual plans are explicitly unexecuted and contain only selected procedures', () => {
  const plan = buildVerificationPlan('purple', ['authorization'], ['src/auth.ts'])
  assert.match(plan, /NOT EXECUTED/)
  assert.match(plan, /Result: NOT RUN/)
  assert.match(plan, /src\/auth.ts/)
  assert.match(plan, /Red-team procedure:/)
  assert.match(plan, /Blue-team procedure:/)
  assert.ok(!plan.includes('Session & token lifecycle'))
})
test('perspective determines procedure content without inventing results', () => {
  assert.ok(!buildVerificationPlan('red', ['sessions'], []).includes('Blue-team procedure:'))
  assert.ok(!buildVerificationPlan('blue', ['sessions'], []).includes('Red-team procedure:'))
  assert.match(buildVerificationPlan('blue', ['sessions'], []), /No source selected/)
})
test('test catalog has unique IDs and evidence requirements for every procedure', () => {
  assert.equal(new Set(verificationPlans.map(plan => plan.id)).size, verificationPlans.length)
  for (const plan of verificationPlans) assert.ok(plan.red && plan.blue && plan.evidence && plan.reference)
})
