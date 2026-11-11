import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCro, parseDentistInput } from './dentist';

test('normalizeCro remove espaços extras e coloca em maiúsculas', () => {
    assert.equal(normalizeCro('  sp   12345 '), 'SP 12345');
});

test('normalizeCro devolve vazio para valores não-texto', () => {
    assert.equal(normalizeCro(undefined), '');
    assert.equal(normalizeCro(123), '');
});

test('parseDentistInput aceita dados válidos e normaliza', () => {
    const result = parseDentistInput({ name: '  Ana   Souza ', cro: 'sp-123', easyDentalId: ' 77 ' });
    assert.deepEqual(result, { ok: true, data: { name: 'Ana Souza', cro: 'SP-123', easyDentalId: '77' } });
});

test('parseDentistInput converte easyDentalId numérico em texto e vazio em null', () => {
    const numeric = parseDentistInput({ name: 'A', cro: '1', easyDentalId: 42 });
    assert.deepEqual(numeric, { ok: true, data: { name: 'A', cro: '1', easyDentalId: '42' } });
    const empty = parseDentistInput({ name: 'A', cro: '1', easyDentalId: '  ' });
    assert.deepEqual(empty, { ok: true, data: { name: 'A', cro: '1', easyDentalId: null } });
});

test('parseDentistInput exige nome', () => {
    assert.deepEqual(parseDentistInput({ name: '  ', cro: '1' }), { ok: false, error: 'Nome é obrigatório' });
});

test('parseDentistInput exige CRO', () => {
    assert.deepEqual(parseDentistInput({ name: 'A', cro: '' }), { ok: false, error: 'CRO é obrigatório' });
});

test('parseDentistInput rejeita corpo inválido', () => {
    assert.deepEqual(parseDentistInput(null), { ok: false, error: 'Nome é obrigatório' });
});
