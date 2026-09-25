import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEmpty, isLossy, lossOf, mergeStates, same, stable } from '../src/lib/merge.ts'

const day = (over: Record<string, unknown> = {}) => ({
  intention: '',
  topDone: false,
  leadWho: '',
  leadDone: false,
  postWhat: '',
  postDone: false,
  wentWell: '',
  improve: '',
  gratitude: ['', '', ''],
  ...over,
})
const task = (id: number, text: string, over: Record<string, unknown> = {}) => ({
  id,
  text,
  done: false,
  category: 'work',
  ...over,
})
const ids = (xs: { id: number }[]) => xs.map((x) => x.id)

test('stable ignores key order, so jsonb round-trips compare equal', () => {
  assert.equal(stable({ a: 1, b: { c: 2, d: 3 } }), stable({ b: { d: 3, c: 2 }, a: 1 }))
  assert.ok(same({ a: [1, { x: 1, y: 2 }] }, { a: [1, { y: 2, x: 1 }] }))
  assert.ok(!same({ a: [1, 2] }, { a: [2, 1] }))
})

test('isEmpty: blanks, false and nests of blanks; never numbers', () => {
  for (const v of ['', false, null, undefined, [], {}, ['', ''], { a: '', b: [false] }]) assert.ok(isEmpty(v), String(v))
  for (const v of [0, 1, 'x', true, ['', 'x'], { id: 1 }]) assert.ok(!isEmpty(v), String(v))
})

test('with a base, the side that left a value alone takes the other side’s change', () => {
  const base = { weekTheme: 'a', tasks: [task(1, 'x')] }
  const local = { weekTheme: 'a', tasks: [task(1, 'x'), task(2, 'y')] }
  const remote = { weekTheme: 'b', tasks: [task(1, 'x')] }
  assert.deepEqual(mergeStates(base, local, remote), { weekTheme: 'b', tasks: [task(1, 'x'), task(2, 'y')] })
})

test('with a base, a value both sides changed goes to local; trust can flip that', () => {
  const base = { weekTheme: 'a' }
  assert.equal(mergeStates(base, { weekTheme: 'l' }, { weekTheme: 'r' }).weekTheme, 'l')
  assert.equal(mergeStates(base, { weekTheme: 'l' }, { weekTheme: 'r' }, 'remote').weekTheme, 'r')
})

test('lists merge by id: additions on both sides kept, deletions honoured, edits taken', () => {
  const base = { tasks: [task(1, 'one'), task(2, 'two'), task(3, 'three')] }
  const local = { tasks: [task(1, 'one'), task(3, 'three'), task(4, 'four')] } // deleted 2, added 4
  const remote = { tasks: [task(1, 'ONE'), task(2, 'two'), task(5, 'five')] } // edited 1, deleted 3, added 5
  const out = mergeStates(base, local, remote)
  assert.deepEqual(ids(out.tasks), [1, 4, 5])
  assert.equal(out.tasks[0].text, 'ONE')
})

test('days merge per date and per field', () => {
  const base = { days: { '2026-09-24': day({ intention: 'x' }) } }
  const local = { days: { '2026-09-24': day({ intention: 'x', topDone: true }) } }
  const remote = {
    days: { '2026-09-24': day({ intention: 'x', leadDone: true }), '2026-09-25': day({ intention: 'y' }) },
  }
  const out = mergeStates(base, local, remote)
  assert.deepEqual(out.days['2026-09-24'], day({ intention: 'x', topDone: true, leadDone: true }))
  assert.deepEqual(out.days['2026-09-25'], day({ intention: 'y' }))
})

test('without a base, additions from both sides are kept', () => {
  const local = { tasks: [task(1, 'a')], days: { '2026-09-25': day({ intention: 'i' }) }, revMadeByMonth: { '2026-09': '5' } }
  const remote = { tasks: [task(2, 'b')], days: { '2026-09-24': day({ intention: 'j' }) }, revMadeByMonth: { '2026-08': '4' } }
  const out = mergeStates(null, local, remote)
  assert.deepEqual(ids(out.tasks), [1, 2])
  assert.deepEqual(Object.keys(out.days).sort(), ['2026-09-24', '2026-09-25'])
  assert.deepEqual(out.revMadeByMonth, { '2026-09': '5', '2026-08': '4' })
})

test('without a base, remote wins a conflict unless it is empty', () => {
  const local = { weekTheme: 'l', monthFocus: 'm', priorities: ['a', '', ''], days: { d: day({ intention: 'li', leadWho: 'me' }) } }
  const remote = { weekTheme: 'r', monthFocus: '', priorities: ['', '', ''], days: { d: day({ intention: 'ri' }) } }
  const out = mergeStates(null, local, remote)
  assert.equal(out.weekTheme, 'r')
  assert.equal(out.monthFocus, 'm')
  assert.deepEqual(out.priorities, ['a', '', ''])
  assert.equal(out.days.d.intention, 'ri')
  assert.equal(out.days.d.leadWho, 'me')
})

test('typing that happened during a push survives the conflict merge (retry path)', () => {
  const board = { weekTheme: 'a', tasks: [task(1, 'x')] } // what was pushed
  const latest = { weekTheme: 'a', tasks: [task(1, 'x'), task(2, 'ty')] } // board + typing since
  const merged = { weekTheme: 'b', tasks: [task(1, 'x')] } // board merged with the winner
  assert.deepEqual(mergeStates(board, latest, merged, 'local'), { weekTheme: 'b', tasks: [task(1, 'x'), task(2, 'ty')] })
})

test('lossOf: additions and legitimate clearing are not losses', () => {
  const prev = { tasks: [task(1, 'a'), task(2, 'b', { done: true })], days: { d1: day({ intention: 'x' }) }, weekTheme: 'w', weekTag: '2026-W39' }
  const more = { ...prev, tasks: [...prev.tasks, task(3, 'c')], days: { ...prev.days, d2: day({ intention: 'y' }) } }
  assert.deepEqual(lossOf(prev, more), { entries: 0, leaves: 0 })
  // day rollover / purge: done tasks dropped
  assert.deepEqual(lossOf(prev, { ...prev, tasks: [task(1, 'a')] }), { entries: 0, leaves: 0 })
  // Archive & reset moved the week on
  const week = { weekTheme: 'w', priorities: ['a', 'b', ''], reviewItems: [task(1, 'r')], weekTag: '2026-W39' }
  const reset = { weekTheme: '', priorities: ['', '', ''], reviewItems: [], weekTag: '2026-W40' }
  assert.deepEqual(lossOf(week, reset), { entries: 0, leaves: 0 })
  // a single task deleted elsewhere is a leaf, not enough to prompt
  const one = lossOf({ tasks: [task(1, 'a'), task(2, 'b')] }, { tasks: [task(1, 'a')] })
  assert.deepEqual(one, { entries: 0, leaves: 1 })
  assert.ok(!isLossy(one))
})

test('lossOf: a vanished day record or month revenue is a lost entry', () => {
  assert.deepEqual(lossOf({ days: { d1: day({ intention: 'x' }) } }, { days: {} }), { entries: 1, leaves: 0 })
  assert.deepEqual(lossOf({ revMadeByMonth: { '2026-09': '1200' } }, { revMadeByMonth: {} }), { entries: 1, leaves: 0 })
  // an empty record that vanishes is nothing
  assert.deepEqual(lossOf({ days: { d1: day() } }, { days: {} }), { entries: 0, leaves: 0 })
})

test('lossOf: the stale-tab clobber shape is lossy', () => {
  const good = {
    tasks: [task(1, 'a'), task(2, 'b'), task(4, 'new'), task(5, 'newer')],
    days: { '2026-09-23': day({ intention: 'i', topDone: true }), '2026-09-25': day({ intention: 'today' }) },
    intentionPromptSeen: '2026-09-25',
    dayTag: '2026-09-25',
  }
  const stale = {
    tasks: [task(1, 'a'), task(2, 'b')],
    days: { '2026-09-23': day({ intention: 'i' }) },
    intentionPromptSeen: '2026-09-25',
    dayTag: '2026-09-25',
  }
  const loss = lossOf(good, stale)
  assert.deepEqual(loss, { entries: 1, leaves: 3 })
  assert.ok(isLossy(loss))
  assert.ok(!isLossy(lossOf(stale, good)))
})
