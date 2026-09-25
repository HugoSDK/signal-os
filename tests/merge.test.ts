import { test } from 'node:test'
import assert from 'node:assert/strict'
import { carryOver, isEmpty, mergeStates, same, stable } from '../src/lib/merge.ts'

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

test('carryOver: with nothing edited here, the incoming board is taken as is', () => {
  const shown = { weekTheme: 'a', tasks: [task(1, 'x')], days: { d: day({ intention: 'i' }) } }
  const incoming = { weekTheme: 'b', tasks: [task(1, 'x'), task(2, 'y')], days: { d: day({ intention: 'j' }) } }
  assert.deepEqual(carryOver(shown, { ...shown }, incoming), incoming)
})

test('carryOver: an edit made here while the board was arriving survives it', () => {
  const shown = { weekTheme: 'a', tasks: [task(1, 'x')], days: { d: day({ intention: 'i' }) } }
  // marked a day and added a task here…
  const current = { weekTheme: 'a', tasks: [task(1, 'x'), task(3, 'mine')], days: { d: day({ intention: 'i', topDone: true }) } }
  // …while another device changed the theme and added a task
  const incoming = { weekTheme: 'b', tasks: [task(1, 'x'), task(2, 'theirs')], days: { d: day({ intention: 'i' }) } }
  const out = carryOver(shown, current, incoming)
  assert.equal(out.weekTheme, 'b')
  assert.deepEqual(ids(out.tasks), [1, 3, 2])
  assert.equal(out.days.d.topDone, true)
})

test('carryOver: a value both sides changed keeps the edit made here', () => {
  const shown = { weekTheme: 'a' }
  assert.equal(carryOver(shown, { weekTheme: 'mine' }, { weekTheme: 'theirs' }).weekTheme, 'mine')
})
