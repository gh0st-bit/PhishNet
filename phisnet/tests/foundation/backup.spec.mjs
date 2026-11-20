import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {packBackup,unpackBackup} from '../../scripts/backup-pilot.mjs';
test('encrypted backup round-trips its manifest without plaintext secrets',()=>{const key=randomBytes(32),data={master:'sample-secret',files:['one']},bytes=packBackup(data,key);assert.ok(!bytes.includes(Buffer.from('sample-secret')));assert.deepEqual(unpackBackup(bytes,key),data);});
test('encrypted backups reject the wrong key',()=>{const bytes=packBackup({value:'secret'},randomBytes(32));assert.throws(()=>unpackBackup(bytes,randomBytes(32)));});
test('encrypted backups reject tampered ciphertext',()=>{const key=randomBytes(32),bytes=packBackup({value:'secret'},key);bytes[bytes.length-1]^=1;assert.throws(()=>unpackBackup(bytes,key));});
