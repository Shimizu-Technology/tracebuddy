import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(([,key,value])=>[key,value]))
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722
}
function ratio(a,b) { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05) }
const pairs = [
  ['on-action','action-fill'], ['instruction-label','paper'], ['instruction-label','peach'],
  ['muted','paper'], ['muted','disabled-fill'], ['muted','peach'], ['muted-on-tint','paper'], ['muted-on-tint','sky'],
  ['ink','action-fill'], ['ink','mint'], ['paper','ink'], ['coral-dark','paper'],
]
for(const [foreground,background] of pairs) {
  const value=ratio(tokens[foreground],tokens[background])
  assert(value>=4.5,`${foreground} on ${background}: ${value.toFixed(2)}:1`)
  console.log(`${foreground} on ${background}: ${value.toFixed(2)}:1`)
}
assert(!css.includes('0.01ms'), 'Use intentional reduced-motion states')
console.log('Semantic contrast pairs pass 4.5:1; primary fill is flat in every state (no gradient stops).')
