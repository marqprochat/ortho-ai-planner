import test from 'node:test';
import assert from 'node:assert/strict';
import {
    analyzeContractDentistText,
    extractReportDentistInfo,
    matchDentistCandidate,
    normalizeCroCode,
    normalizePersonName,
    replaceReportDentistInfo,
} from './dentistMatcher';

const target = { id: 'd1', name: 'Dra. Ana Paula Souza', cro: 'SP-12345' };

test('normalizePersonName remove títulos, acentos e pontuação', () => {
    assert.equal(normalizePersonName('Dr. João Cláudio-Silva'), 'joao claudio silva');
    assert.equal(normalizePersonName('Dra. Ana Paula Souza'), 'ana paula souza');
});

test('normalizeCroCode normaliza formatos diferentes de CRO', () => {
    assert.equal(normalizeCroCode('CRO-SP 12.345'), 'SP12345');
    assert.equal(normalizeCroCode('sp-12345'), 'SP12345');
});

test('matchDentistCandidate identifica nome exato ignorando prefixo Dr/Dra e acentos', () => {
    const res = matchDentistCandidate('Ana Paula Souza', null, target);
    assert.equal(res.matched, true);
    assert.equal(res.score, 1);
});

test('matchDentistCandidate identifica nome parcial e erro de digitação', () => {
    const partial = matchDentistCandidate('Ana Souza', null, target);
    assert.equal(partial.matched, true);
    assert.ok(partial.score >= 0.9);

    const typo = matchDentistCandidate('Ana Puula Sousa', null, target);
    assert.equal(typo.matched, true);
});

test('matchDentistCandidate identifica CRO exato mesmo com nome abreviado', () => {
    const res = matchDentistCandidate('A. Souza', 'CRO/SP 12345', target);
    assert.equal(res.matched, true);
    assert.equal(res.reason, 'CRO exato');
});

test('matchDentistCandidate rejeita nomes claramente distintos', () => {
    const res = matchDentistCandidate('Dr. Carlos Eduardo Lima', 'MG-99999', target);
    assert.equal(res.matched, false);
});

test('extractReportDentistInfo e replaceReportDentistInfo atualizam cabeçalho do relatório', () => {
    const report = '- Paciente: Teste\n- Ortodontista: Ana Souza\n- CRO: 12345\n';
    assert.deepEqual(extractReportDentistInfo(report), { name: 'Ana Souza', cro: '12345' });
    const updated = replaceReportDentistInfo(report, target);
    assert.match(updated, /- Ortodontista: Dra\. Ana Paula Souza/);
    assert.match(updated, /- CRO: SP-12345/);
});

test('analyzeContractDentistText detecta e substitui linha de dentista e CRO', () => {
    const content = 'TERMO\nDentista: Ana Souza\nCRO: 0000\nAssinatura';
    const match = analyzeContractDentistText(content, target);
    assert.ok(match);
    assert.equal(match?.currentName, 'Ana Souza');
    assert.match(match!.updatedContent, /Dentista: Dra\. Ana Paula Souza/);
    assert.match(match!.updatedContent, /CRO: SP-12345/);
});

