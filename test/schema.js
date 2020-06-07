const md5 = require('md5');
const test = require('ava');
const db = require('../lib/db');

test.beforeEach(async () => {
	await db.reset();
	await db.createTables();
});

test.serial('Should calculate stats correctly', async t => {
	await db.insertStat(md5('joburg'), 50314925, 4, 'HS15', false, 'UZH');
	await db.insertStat(md5('jabond'), 50314925, 4.5, 'HS15', false, 'UZH');
	await db.insertStat(md5('abcdef'), 50314925, 3, 'HS15', false, 'UZH');
	await db.insertStat(md5('xyzabc'), 50314925, 6, 'HS14', false, 'UZH');
	await db.insertStat(md5('xyzabd'), 50314922, 5, 'HS15', false, 'UZH');

	const result = await db.getStatsBySemester(50314925, 'UZH');
	t.is(result.rows[0].semester, 'HS15');
	t.is(result.rows[0].average, 3.83);
	t.is(result.rows[0].passed, 2);
	t.is(result.rows[0].failed, 1);
	t.is(result.rows[0].count, 3);

	t.is(result.rows[1].semester, 'HS14');
	t.is(result.rows[1].average, 6);
	t.is(result.rows[1].passed, 1);
	t.is(result.rows[1].failed, 0);
	t.is(result.rows[1].count, 1);

	const result2 = await db.getStatsBySemester(50314922, 'UZH');
	t.is(result2.rows[0].semester, 'HS15');
	t.is(result2.rows[0].average, 5);
	t.is(result2.rows[0].passed, 1);
	t.is(result2.rows[0].failed, 0);
	t.is(result2.rows[0].count, 1);
});

test.serial('Batch inserting should work correctly', async t => {
	await db.insertStats([
		[md5('joburg'), 50314925, 4, 'HS15', false, 'UZH'],
		[md5('joburg'), 50314926, 4, 'HS15', false, 'UZH'],
		[md5('joburg'), 50314927, 4, 'HS15', false, 'UZH'],
		[md5('joburg'), 50314928, 4, 'HS15', false, 'UZH']
	]);
	// Some duplicates, some new
	await db.insertStats([
		[md5('joburg'), 50314925, 4, 'HS15', false, 'UZH'],
		[md5('joburg'), 50314930, 4, 'HS15', false, 'UZH'],
		[md5('joburg'), 50314931, 4, 'HS15', false, 'UZH'],
		[md5('joburg'), 50314928, 4, 'HS15', false, 'UZH']
	]);

	const result = await db.getStatsBySemester(50314925, 'UZH');
	t.is(result.rows[0].count, 1);
	const result2 = await db.getStatsBySemester(50314930, 'UZH');
	t.is(result2.rows[0].count, 1);
});

test.serial('Should not allow two entries from the same person', async t => {
	const result = await db.insertStat(
		md5('joburg'),
		50314925,
		4.5,
		'HS15',
		false,
		'UZH'
	);
	t.is(result.command, 'INSERT');

	await t.throwsAsync(() =>
		db.insertStat(md5('joburg'), 50314925, 5, 'HS15', false, 'UZH')
	);
});

test.serial(
	'Should allow two entries if it is a Wiederholungsprüfung',
	async t => {
		const result = await db.insertStat(
			md5('joburg'),
			50314925,
			4.5,
			'HS15',
			false,
			'UZH'
		);
		t.is(result.command, 'INSERT');

		await t.notThrows(() =>
			db.insertStat(md5('joburg'), 50314925, 5, 'HS15', true, 'UZH')
		);
	}
);

test.serial('Should tell me if I am opted out', async t => {
	const result = await db.studentIsOptedIn(md5('joburg'), 'UZH');
	t.is(result, false);
});

test.serial('Should tell me if I am opted in', async t => {
	await db.insertStat(md5('joburg'), 50314925, 4, 'HS15', false, 'UZH');
	const result = await db.studentIsOptedIn(md5('joburg'), 'UZH');
	t.is(result, true);
});

test.serial('Should correctly insert statistics', async t => {
	const statistic = {
		source: 'oecnews Nr. 124',
		module: 50030855,
		comment: 'Betriebswirtschaftslehre II',
		passed: 664,
		failed: 308,
		average: 4.14,
		semester: 'FS14',
		institution: 'UZH'
	};
	await db.insertPredefined(statistic);
	await db.insertStat(md5('joburg'), 50030855, 6, 'FS15', false, 'UZH');
	await db.insertStat(md5('joburg'), 50030855, 3.5, 'FS14', false, 'UZH');
	await db.insertStat(md5('joburg'), 50030855, 6, 'FS13', false, 'UZH');

	const stats = await db.getAllStats(50030855, 'UZH');
	t.is(stats.total.passed, 666);
	t.is(stats.total.average, 4.14);
});

test.serial('Should work with more universities', async t => {
	await db.insertStat(
		'da17d6edea42bf74fcd26015a9975030',
		50044544,
		4.25,
		'HS14',
		false,
		'UZH'
	);
	await db.insertStat(
		'da17d6edea42bf74fcd26015a9975030',
		50044544,
		4.25,
		'HS14',
		false,
		'ETH'
	);

	const stats = await db.getAllStats(50044544, 'UZH');
	const stats2 = await db.getAllStats(50044544, 'ETH');
	t.is(stats.total.passed, 1);
	t.is(stats2.total.passed, 1);
});

test.serial('Irrelevant statistic should not influence', async t => {
	await db.insertPredefined({
		source: 'Test statistic',
		module: 123456,
		comment: 'Test module',
		passed: 1,
		failed: 0,
		average: 6,
		semester: 'HS14',
		institution: 'UZH'
	});
	await db.insertStat(
		'da17d6edea42bf74fcd26015a9975030',
		50044544,
		4.25,
		'HS14',
		false,
		'UZH'
	);
	await db.insertStat(
		'da17d6edea42bf74fcd26015a9975030',
		50044544,
		2.75,
		'HS13',
		false,
		'UZH'
	);
	await db.insertStat(
		'c6042315ea9022d68a60bdac3bd07250',
		50044544,
		4.5,
		'HS13',
		false,
		'UZH'
	);

	const stats = await db.getAllStats(50044544, 'UZH');

	t.is(stats.total.passed, 2);
});
