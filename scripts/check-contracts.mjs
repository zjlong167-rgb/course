import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { validateCourse } from '../contracts/validate.mjs'
let count=0
for(const dir of ['valid','invalid']) for(const file of readdirSync(`samples/${dir}`)) {
  const errors=validateCourse(JSON.parse(readFileSync(`samples/${dir}/${file}`,'utf8')))
  assert.equal(errors.length===0,dir==='valid',`${file}: ${errors}`)
  console.log(`${dir==='valid'?'ACCEPT':'REJECT'} ${file}${errors.length ? ': '+errors[0] : ''}`); count++
}
console.log(`${count} contract fixtures passed`)
