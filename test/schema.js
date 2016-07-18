import md5 from 'md5';
import test from 'ava';
import db from '../lib/db';

test.beforeEach(async () => {
	await db.reset();
	await db.createTables();
});

test('Should calculate stats correctly', async t => {
	await db.insertStat(md5('joburg'), 50314925, 4, 'HS15', false);
	await db.insertStat(md5('jabond'), 50314925, 4.5, 'HS15', false);
	await db.insertStat(md5('abcdef'), 50314925, 3, 'HS15', false);
	await db.insertStat(md5('xyzabc'), 50314925, 6, 'HS14', false);
	await db.insertStat(md5('xyzabd'), 50314922, 5, 'HS15', false);

	const result = await db.getStatsBySemester(50314925);
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

	const result2 = await db.getStatsBySemester(50314922);
	t.is(result2.rows[0].semester, 'HS15');
	t.is(result2.rows[0].average, 5);
	t.is(result2.rows[0].passed, 1);
	t.is(result2.rows[0].failed, 0);
	t.is(result2.rows[0].count, 1);
});

test('Should not allow two entries from the same person', async t => {
	const result = await db.insertStat(md5('joburg'), 50314925, 4.5, 'HS15', false);
	t.is(result.command, 'INSERT');

	t.throws(db.insertStat(md5('joburg'), 50314925, 5, 'HS15', false));
});

test('Should allow two entries if it is a Wiederholungsprüfung', async t => {
	const result = await db.insertStat(md5('joburg'), 50314925, 4.5, 'HS15', false);
	t.is(result.command, 'INSERT');

	t.notThrows(db.insertStat(md5('joburg'), 50314925, 5, 'HS15', true));
});

test('Should tell me if I am opted out', async t => {
	const result = await db.studentIsOptedIn(md5('joburg'));
	t.is(result, false);
});

test('Should tell me if I am opted in', async t => {
	await db.insertStat(md5('joburg'), 50314925, 4, 'HS15', false);
	const result = await db.studentIsOptedIn(md5('joburg'));
	t.is(result, true);
});

test('Should correctly insert statistics', async t => {
	const statistic = {
		source: 'oecnews Nr. 124',
		points: [
			{
				module: 50030855,
				comment: 'Betriebswirtschaftslehre II',
				passed: 664,
				failed: 308,
				average: 4.14,
				semester: 'FS14'
			}
		]
	};
	await db.insertPredefined(statistic);
	await db.insertStat(md5('joburg'), 50030855, 6, 'FS15', false);
	await db.insertStat(md5('joburg'), 50030855, 3.5, 'FS14', false);
	await db.insertStat(md5('joburg'), 50030855, 6, 'FS13', false);
	const stats = await db.getAllStats(50030855);
	t.is(stats.total.passed, 666);
	t.is(stats.total.average, 4.14);
});
