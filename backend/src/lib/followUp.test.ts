import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode } from './patientCode';
import { selectFollowUpRecords, parseFollowUpParams, FOLLOW_UP_SEARCH_MODE, addDays, recentWindow } from './followUp';
import type { UltimaConsultaRecord } from './easydental';

const rec = (over: Partial<UltimaConsultaRecord> = {}): UltimaConsultaRecord => ({
    PACIENTE: 'Paciente Teste',
    CODIGO: '000653',
    ULTIMA_CONSULTA: '2026-08-01',
    CELULAR: '11999990000',
    CONSULTA_AGENDADA: null,
    UNIDADE: 'Unidade A',
    ...over,
});

const codes = (...values: string[]) => new Set(values.map((v) => normalizeCode(v) as string));

test('FOLLOW_UP_SEARCH_MODE tem o valor combinado', () => {
    assert.equal(FOLLOW_UP_SEARCH_MODE, 'tratamento-sem-reagendamento');
});

test('normalizeCode iguala 653, 000653 e códigos com máscara', () => {
    assert.equal(normalizeCode('653'), '000653');
    assert.equal(normalizeCode('000653'), '000653');
    assert.equal(normalizeCode('00.653'), '000653');
    assert.equal(normalizeCode(''), null);
    assert.equal(normalizeCode(null), null);
    assert.equal(normalizeCode('abc'), null);
});

test('inclui paciente em tratamento sem consulta agendada', () => {
    const result = selectFollowUpRecords([rec()], codes('653'));
    assert.equal(result.length, 1);
    assert.equal(result[0].CODIGO, '000653');
});

test('exclui paciente com consulta agendada', () => {
    const result = selectFollowUpRecords([rec({ CONSULTA_AGENDADA: '2026-10-20' })], codes('653'));
    assert.equal(result.length, 0);
});

test('trata consulta agendada vazia ou só com espaços como sem agendamento', () => {
    const result = selectFollowUpRecords(
        [rec({ CONSULTA_AGENDADA: '' }), rec({ CODIGO: '000700', CONSULTA_AGENDADA: '   ' })],
        codes('653', '700')
    );
    assert.equal(result.length, 2);
});

test('exclui paciente que não está em tratamento no Planner', () => {
    const result = selectFollowUpRecords([rec({ CODIGO: '000999' })], codes('653'));
    assert.equal(result.length, 0);
});

test('casa código do Planner sem zeros com código do EasyDental com zeros', () => {
    const result = selectFollowUpRecords([rec({ CODIGO: '000653' })], codes('653'));
    assert.equal(result.length, 1);
});

test('se o paciente reagendou em outra unidade, sai da lista inteira', () => {
    const result = selectFollowUpRecords(
        [
            rec({ UNIDADE: 'Unidade A', CONSULTA_AGENDADA: null }),
            rec({ UNIDADE: 'Unidade B', CONSULTA_AGENDADA: '2026-10-20' }),
        ],
        codes('653')
    );
    assert.equal(result.length, 0);
});

test('mantém o mesmo paciente em duas unidades quando nenhuma tem agendamento', () => {
    const result = selectFollowUpRecords(
        [rec({ UNIDADE: 'Unidade A' }), rec({ UNIDADE: 'Unidade B' })],
        codes('653')
    );
    assert.equal(result.length, 2);
});

test('remove duplicados do mesmo paciente na mesma unidade', () => {
    const result = selectFollowUpRecords([rec(), rec()], codes('653'));
    assert.equal(result.length, 1);
});

test('ignora registros sem código', () => {
    const result = selectFollowUpRecords(
        [rec({ CODIGO: '' }), rec({ CODIGO: undefined as unknown as string })],
        codes('653')
    );
    assert.equal(result.length, 0);
});

test('conjunto de tratamentos vazio não devolve ninguém', () => {
    assert.equal(selectFollowUpRecords([rec()], new Set()).length, 0);
});

test('parseFollowUpParams aceita datas e normaliza unidades', () => {
    const result = parseFollowUpParams({
        dt_inicio: '2026-04-01',
        dt_termino: '2026-09-01',
        unidades: ['  Unidade A ', '', 'Unidade B'],
    });
    assert.deepEqual(result, {
        ok: true,
        data: { dtInicio: '2026-04-01', dtTermino: '2026-09-01', unidades: ['Unidade A', 'Unidade B'] },
    });
});

test('parseFollowUpParams aceita unidade como texto e ausente como lista vazia', () => {
    const one = parseFollowUpParams({ dt_inicio: '2026-04-01', dt_termino: '2026-09-01', unidades: 'Unidade A' });
    assert.deepEqual(one.ok && one.data.unidades, ['Unidade A']);
    const none = parseFollowUpParams({ dt_inicio: '2026-04-01', dt_termino: '2026-09-01' });
    assert.deepEqual(none.ok && none.data.unidades, []);
});

test('parseFollowUpParams rejeita datas ausentes, mal formatadas ou impossíveis', () => {
    const message = 'dt_inicio e dt_termino são obrigatórios (AAAA-MM-DD)';
    assert.deepEqual(parseFollowUpParams({}), { ok: false, error: message });
    assert.deepEqual(parseFollowUpParams({ dt_inicio: '01/04/2026', dt_termino: '2026-09-01' }), { ok: false, error: message });
    assert.deepEqual(parseFollowUpParams({ dt_inicio: '2026-02-30', dt_termino: '2026-09-01' }), { ok: false, error: message });
    assert.deepEqual(parseFollowUpParams(null), { ok: false, error: message });
});

test('parseFollowUpParams rejeita início maior que término', () => {
    assert.deepEqual(
        parseFollowUpParams({ dt_inicio: '2026-09-02', dt_termino: '2026-09-01' }),
        { ok: false, error: 'dt_inicio não pode ser maior que dt_termino' }
    );
});

test('parseFollowUpParams com requireCodes exige lista de códigos de texto', () => {
    const base = { dt_inicio: '2026-04-01', dt_termino: '2026-09-01' };
    const ok = parseFollowUpParams({ ...base, codigos: ['000653', ' 700 '] }, { requireCodes: true });
    assert.deepEqual(ok.ok && ok.data.codigos, ['000653', '700']);
    const error = 'codigos deve ser uma lista de códigos';
    assert.deepEqual(parseFollowUpParams(base, { requireCodes: true }), { ok: false, error });
    assert.deepEqual(parseFollowUpParams({ ...base, codigos: [123] }, { requireCodes: true }), { ok: false, error });
    assert.deepEqual(parseFollowUpParams({ ...base, codigos: 'x' }, { requireCodes: true }), { ok: false, error });
});

test('parseFollowUpParams limita a quantidade de códigos', () => {
    const codigos = Array.from({ length: 5001 }, (_, i) => String(i));
    const result = parseFollowUpParams({ dt_inicio: '2026-04-01', dt_termino: '2026-09-01', codigos }, { requireCodes: true });
    assert.deepEqual(result, { ok: false, error: 'codigos excede o limite de 5000' });
});

test('addDays soma dias em UTC atravessando mês, ano e valores negativos', () => {
    assert.equal(addDays('2026-10-05', 1), '2026-10-06');
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
    assert.equal(addDays('2026-10-05', 0), '2026-10-05');
});

test('recentWindow devolve [dtTermino+1, hoje] ou null', () => {
    assert.deepEqual(recentWindow('2026-09-05', '2026-10-05'), { dtInicio: '2026-09-06', dtTermino: '2026-10-05' });
    assert.equal(recentWindow('2026-10-05', '2026-10-05'), null);
    assert.equal(recentWindow('2026-10-20', '2026-10-05'), null);
    assert.deepEqual(recentWindow('2026-10-04', '2026-10-05'), { dtInicio: '2026-10-05', dtTermino: '2026-10-05' });
});

test('janela dtInicio/dtTermino: mantém dentro (limites inclusivos) e exclui fora', () => {
    const opts = { dtInicio: '2026-03-01', dtTermino: '2026-09-01' };
    const result = selectFollowUpRecords(
        [
            rec({ CODIGO: '000001', ULTIMA_CONSULTA: '2026-06-15' }),
            rec({ CODIGO: '000002', ULTIMA_CONSULTA: '2026-03-01' }),
            rec({ CODIGO: '000003', ULTIMA_CONSULTA: '2026-09-01' }),
            rec({ CODIGO: '000004', ULTIMA_CONSULTA: '2026-02-28' }),
            rec({ CODIGO: '000005', ULTIMA_CONSULTA: '2026-09-02' }),
        ],
        codes('1', '2', '3', '4', '5'),
        opts
    );
    assert.deepEqual(result.map((r) => r.CODIGO), ['000001', '000002', '000003']);
});

test('janela: ULTIMA_CONSULTA ausente ou ilegível é excluída', () => {
    const opts = { dtInicio: '2026-03-01', dtTermino: '2026-09-01' };
    const result = selectFollowUpRecords(
        [
            rec({ CODIGO: '000001', ULTIMA_CONSULTA: null as unknown as string }),
            rec({ CODIGO: '000002', ULTIMA_CONSULTA: '' }),
            rec({ CODIGO: '000003', ULTIMA_CONSULTA: 'ontem' }),
            rec({ CODIGO: '000004', ULTIMA_CONSULTA: undefined as unknown as string }),
        ],
        codes('1', '2', '3', '4'),
        opts
    );
    assert.equal(result.length, 0);
});

test('janela: aceita ISO com horário (2026-09-11T00:00:00.000Z)', () => {
    const opts = { dtInicio: '2026-09-01', dtTermino: '2026-09-11' };
    const result = selectFollowUpRecords(
        [
            rec({ CODIGO: '000001', ULTIMA_CONSULTA: '2026-09-11T00:00:00.000Z' }),
            rec({ CODIGO: '000002', ULTIMA_CONSULTA: '2026-09-12T00:00:00.000Z' }),
        ],
        codes('1', '2'),
        opts
    );
    assert.deepEqual(result.map((r) => r.CODIGO), ['000001']);
});

test('seenAfterCodes exclui quem consultou depois da janela (código normalizado vs registro com zeros)', () => {
    const seenAfterCodes = new Set([normalizeCode('653') as string]);
    const result = selectFollowUpRecords(
        [rec({ CODIGO: '000653' }), rec({ CODIGO: '000700' })],
        codes('653', '700'),
        { seenAfterCodes }
    );
    assert.deepEqual(result.map((r) => r.CODIGO), ['000700']);
});

test('regressão: 000653 sem agenda na unidade A e 653 com agenda na unidade B sai por completo', () => {
    const result = selectFollowUpRecords(
        [
            rec({ CODIGO: '000653', UNIDADE: 'Unidade A', CONSULTA_AGENDADA: null }),
            rec({ CODIGO: '653', UNIDADE: 'Unidade B', CONSULTA_AGENDADA: '2026-10-20T00:00:00.000Z' }),
        ],
        codes('653'),
        { dtInicio: '2026-03-01', dtTermino: '2026-09-01' }
    );
    assert.equal(result.length, 0);
});

test('sem options mantém o comportamento antigo (sem checar janela nem seenAfter)', () => {
    const result = selectFollowUpRecords([rec({ ULTIMA_CONSULTA: 'qualquer coisa' })], codes('653'));
    assert.equal(result.length, 1);
    const withEmpty = selectFollowUpRecords([rec({ ULTIMA_CONSULTA: 'qualquer coisa' })], codes('653'), {});
    assert.equal(withEmpty.length, 1);
});
