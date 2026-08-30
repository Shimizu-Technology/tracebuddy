import assert from 'node:assert/strict'

import { isDismissedPrintSheet } from '../mobile/printUtils.ts'

assert.equal(isDismissedPrintSheet({ code: 'ERR_PRINT_INCOMPLETE' }, 'ios'), true)
assert.equal(isDismissedPrintSheet(new Error('Printing did not complete'), 'ios'), true)
assert.equal(isDismissedPrintSheet({ code: 'ERR_PRINT_INCOMPLETE' }, 'android'), false)
assert.equal(isDismissedPrintSheet(new Error('Printer connection failed'), 'ios'), false)
assert.equal(isDismissedPrintSheet(null, 'ios'), false)

console.log('Mobile print cancellation checks passed')
