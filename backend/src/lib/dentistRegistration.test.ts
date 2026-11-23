import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDateWindows,
    buildRegistrationPlan,
    extractUnitsFromKpi,
    formatCpfDigits,
    isValidCpf,
    normalizeName,
    normalizePrestador,
    summarizePlan,
    ExistingDentistRef,
    PlanInput,
} from './dentistRegistration';

const clinics = [
    { id: 'c-camp', name: 'Dental Kids Campinas', nickname: 'Campinas', easyDentalUnitName: 'Campinas' },
    { id: 'c-ped', name: 'Dental Kids Pedreira', nickname: null, easyDentalUnitName: 'Pedreira' },
    { id: 'c-ov', name: 'Dental Kids Ouro Verde', nickname: null, easyDentalUnitName: 'Ouro Verde' },
    { id: 'c-sem', name: 'Clínica sem unidade', nickname: null, easyDentalUnitName: null },
];

const baseInput = (over: Partial<PlanInput> = {}): PlanInput => ({
    units: ['Campinas', 'Pedreira'],
    clinics,
    accessibleClinicIds: new Set(['c-camp', 'c-ped']),
    existing: [],
    cpf: '529.982.247-25',
    easyDentalId: '77',
    prestadorName: 'Sara Oliveira Silva',
    currentClinicId: 'c-camp',
    ...over,
});

const dentist = (over: Partial<ExistingDentistRef>): ExistingDentistRef => ({
    id: 'd1', clinicId: 'c-camp', name: 'Outra Pessoa', cro: 'SP-1', cpf: null, easyDentalId: null, isActive: true, ...over,
});

test('isValidCpf valida dígitos verificadores', () => {
    assert.equal(isValidCpf('529.982.247-25'), true);
    assert.equal(isValidCpf('52998224725'), true);
    assert.equal(isValidCpf('529.982.247-24'), false);
    assert.equal(isValidCpf('111.111.111-11'), false);
    assert.equal(isValidCpf('123'), false);
});

test('formatCpfDigits formata no padrão 000.000.000-00', () => {
    assert.equal(formatCpfDigits('52998224725'), '529.982.247-25');
});

test('normalizeName ignora acentos, caixa e espaços', () => {
    assert.equal(normalizeName('  Ouro   Verde '), 'ouro verde');
    assert.equal(normalizeName('Paulínia'), normalizeName('PAULINIA'));
});

test('todas as unidades acessíveis e sem cadastro ficam para cadastrar', () => {
    const rows = buildRegistrationPlan(baseInput());
    assert.deepEqual(rows.map((r) => [r.unitName, r.clinicId, r.status]), [
        ['Campinas', 'c-camp', 'will_register'],
        ['Pedreira', 'c-ped', 'will_register'],
    ]);
    assert.equal(summarizePlan(rows).canRegisterAll, true);
});

test('unidade sem acesso do usuário fica como no_access', () => {
    const rows = buildRegistrationPlan(baseInput({ accessibleClinicIds: new Set(['c-camp']) }));
    const summary = summarizePlan(rows);
    assert.deepEqual(summary.noAccess.map((r) => r.clinicId), ['c-ped']);
    assert.deepEqual(summary.toRegister.map((r) => r.clinicId), ['c-camp']);
    assert.equal(summary.canRegisterAll, false);
});

test('unidade do EasyDental sem clínica vinculada fica como no_clinic', () => {
    const rows = buildRegistrationPlan(baseInput({ units: ['Campinas', 'Americana'] }));
    assert.deepEqual(rows[1], { unitName: 'Americana', clinicId: null, clinicName: null, status: 'no_clinic', source: 'unit' });
});

test('casa unidade com espaço sobrando e acento diferente', () => {
    const rows = buildRegistrationPlan(baseInput({ units: ['Ouro Verde '], accessibleClinicIds: new Set(['c-ov']) }));
    assert.equal(rows[0].clinicId, 'c-ov');
    assert.equal(rows[0].status, 'will_register');
});

test('já cadastrado por CPF, ID EasyDental ou nome padronizado', () => {
    const byCpf = buildRegistrationPlan(baseInput({ existing: [dentist({ cpf: '52998224725' })] }));
    assert.equal(byCpf[0].status, 'already_registered');
    assert.equal(byCpf[0].existingDentist?.id, 'd1');

    const byId = buildRegistrationPlan(baseInput({ existing: [dentist({ easyDentalId: '77' })] }));
    assert.equal(byId[0].status, 'already_registered');

    const byName = buildRegistrationPlan(baseInput({ existing: [dentist({ name: 'SARA OLIVEIRA SILVA' })] }));
    assert.equal(byName[0].status, 'already_registered');

    const otherClinic = buildRegistrationPlan(baseInput({ existing: [dentist({ clinicId: 'c-x', cpf: '52998224725' })] }));
    assert.equal(otherClinic[0].status, 'will_register');
});

test('já cadastrado vale mesmo sem acesso à clínica', () => {
    const rows = buildRegistrationPlan(baseInput({
        accessibleClinicIds: new Set(['c-camp']),
        existing: [dentist({ clinicId: 'c-ped', cpf: '52998224725' })],
    }));
    assert.equal(rows[1].status, 'already_registered');
    assert.equal(summarizePlan(rows).canRegisterAll, true);
});

test('sem unidades no EasyDental oferece a clínica selecionada', () => {
    const rows = buildRegistrationPlan(baseInput({ units: [], currentClinicId: 'c-sem', accessibleClinicIds: new Set(['c-sem']) }));
    assert.deepEqual(rows.map((r) => [r.unitName, r.clinicId, r.status, r.source]), [[null, 'c-sem', 'will_register', 'current_clinic']]);
});

test('unidades sem clínica vinculada também recebem a clínica selecionada como alternativa', () => {
    const rows = buildRegistrationPlan(baseInput({ units: ['Americana'] }));
    assert.deepEqual(rows.map((r) => [r.unitName, r.clinicId, r.status, r.source]), [
        ['Americana', null, 'no_clinic', 'unit'],
        ['Campinas', 'c-camp', 'will_register', 'current_clinic'],
    ]);
});

test('unidades repetidas não geram linhas duplicadas', () => {
    const rows = buildRegistrationPlan(baseInput({ units: ['Campinas', 'campinas', ' Campinas'] }));
    assert.equal(rows.length, 1);
});

test('normalizePrestador aceita as chaves em minúsculas devolvidas pela API', () => {
    assert.deepEqual(
        normalizePrestador({ id_prestador: 6534, nm_prestador: 'Beatriz Helena de Toledo' }),
        { ID_PRESTADOR: 6534, NOME: 'Beatriz Helena de Toledo' }
    );
    assert.deepEqual(normalizePrestador({ ID_PRESTADOR: '7', NOME: 'Ana' }), { ID_PRESTADOR: '7', NOME: 'Ana' });
    assert.equal(normalizePrestador({}), null);
    assert.equal(normalizePrestador(null), null);
});

test('plano com as unidades reais da prestadora e todas as clínicas vinculadas', () => {
    const units = ['Campinas', 'Paulínia', 'Hortolândia', 'Guanabara', 'Sumaré', 'Rosolen', 'Piracicaba',
        'Paineiras', 'Valinhos', 'Nova Odessa', 'Pedreira', 'Ouro Verde ', 'Americana'];
    const allClinics = units.map((u, i) => ({ id: `c${i}`, name: `Dental Kids ${u.trim()}`, nickname: null, easyDentalUnitName: u.trim() }));
    const rows = buildRegistrationPlan({
        units: ['Americana', 'Hortolândia', 'Piracicaba'],
        clinics: allClinics,
        accessibleClinicIds: new Set(allClinics.map((c) => c.id)),
        existing: [],
        cpf: '423.122.848-55',
        easyDentalId: '6534',
        prestadorName: 'Beatriz Helena de Toledo',
        currentClinicId: 'c0',
    });
    assert.deepEqual(rows.map((r) => [r.clinicName, r.status, r.source]), [
        ['Dental Kids Americana', 'will_register', 'unit'],
        ['Dental Kids Hortolândia', 'will_register', 'unit'],
        ['Dental Kids Piracicaba', 'will_register', 'unit'],
    ]);
});

test('buildDateWindows quebra o período em janelas de até 30 dias', () => {
    const windows = buildDateWindows(new Date(2026, 10, 17), 90);
    assert.deepEqual(windows, [
        { dt_inicio: '2026-10-19', dt_termino: '2026-11-17' },
        { dt_inicio: '2026-09-19', dt_termino: '2026-10-18' },
        { dt_inicio: '2026-08-20', dt_termino: '2026-09-18' },
    ]);
});

test('extractUnitsFromKpi filtra pelo prestador e remove duplicadas', () => {
    const rows = [
        { TX_PRESTADOR: 'Sara Oliveira Silva', TX_UNIDADE_ATENDIMENTO: 'Pedreira' },
        { TX_PRESTADOR: 'sara oliveira silva', TX_UNIDADE_ATENDIMENTO: 'Pedreira ' },
        { TX_PRESTADOR: 'Sara Oliveira Silva', TX_UNIDADE_ATENDIMENTO: 'Campinas' },
        { TX_PRESTADOR: 'Outra', TX_UNIDADE_ATENDIMENTO: 'Sumaré' },
        { '': 'PERIODO INVALIDO OU ACIMA DE 35 DIAS' },
    ];
    assert.deepEqual(extractUnitsFromKpi(rows, 'Sara Oliveira Silva'), ['Pedreira', 'Campinas']);
    assert.deepEqual(extractUnitsFromKpi({ error: 'x' }, 'Sara'), []);
});
