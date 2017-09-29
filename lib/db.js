const pg = require('pg');
const co = require('co');
const _ = require('underscore');
const uzhSemesters = require('@jonny/uzh-semesters');
const isMd5 = require('is-md5');

process.env.PGDATABASE = process.env.PG_DATABASE || process.env.PGDATABASE;
process.env.PGUSER = process.env.PG_USER || process.env.PGUSER;

const connection = new pg.Client();

connection.connect(err => {
	if (err) {
		throw err;
	}
});

exports.reset = function () {
	if (process.env.PGHOST.indexOf('.ch') !== -1) {
		throw new Error('Do not reset prod db!');
	}
	return new Promise((resolve, reject) => {
		connection.query(`
			drop table if exists grades;
			drop table if exists statistics;
			drop table if exists optouts;
		`, function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.createTables = function () {
	return new Promise((resolve, reject) => {
		connection.query(`
			create table if not exists grades (
				student char(32) not null,
				module integer not null,
				grade real not null check (grade >= 1) check(grade <= 6),
				semester varchar(10) not null,
				is_repeated boolean not null,
				unique(student, module, semester, is_repeated)
			);
			create table if not exists statistics (
				source varchar(255) not null,
				module integer not null,
				average real not null,
				semester varchar(10) not null,
				passed integer not null,
				failed integer not null,
				unique(module, semester)
			);
			create table if not exists optouts (
				student char(32) not null,
				date timestamp not null
			);
		`, function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.insertStat = function (student, module, grade, semester, repeated) {
	if (!uzhSemesters.isValid(semester)) {
		throw new Error('Invalid semester');
	}
	if (!isMd5(student)) {
		throw new Error('Student should be a MD5 hash');
	}
	if (student === 'f791a235e89700b87a69d26ac8f10d71') {
		throw new Error('Der Demo-Account kann diese Aktion nicht ausführen');
	}
	if (student === 'd41d8cd98f00b204e9800998ecf8427e') {
		throw new Error('Ungültiger Benutzername');
	}
	return new Promise((resolve, reject) => {
		connection.query(`
			insert into grades values ($1::text, $2::integer, $3::real, $4::text, $5::boolean);
		`, [student, module, grade, semester, repeated], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.studentIsOptedIn = function (student) {
	return new Promise((resolve, reject) => {
		connection.query(`
			select cast(count(*) as integer) from grades where student = $1::text
		`, [student], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(Boolean(result.rows[0].count));
			}
		});
	});
};

exports.studentOptOutCount = function (student) {
	return new Promise((resolve, reject) => {
		connection.query(`
			select cast(count(*) as integer) from optouts where student = $1::text
		`, [student], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result.rows[0].count);
			}
		});
	});
};

exports.getTotalStats = function (module) {
	return new Promise((resolve, reject) => {
		connection.query(`
			select
				cast(round(cast(avg(grade) as numeric), 2) as real) as average,
				cast(round(cast(median(grade) as numeric), 2) as real) as median,
				cast(round(cast(stddev_samp(grade) as numeric), 2) as real) as stddev,
				cast(sum(case when grade >= 4 then 1 else 0 end) as integer) as passed,
				cast(sum(case when grade < 4 then 1 else 0 end) as integer) as failed,
				cast(count(grade) as integer) as count
			from grades
			where module = $1::integer
			and semester not in (
				select semester from statistics where module = $1::integer
			)
		`, [module], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.getStatsBySemester = function (module) {
	return new Promise((resolve, reject) => {
		connection.query(`
			select
				cast(round(cast(avg(grade) as numeric), 2) as real) as average,
				semester,
				cast(sum(case when grade >= 4 then 1 else 0 end) as integer) as passed,
				cast(sum(case when grade < 4  then 1 else 0 end) as integer) as failed,
				cast(count(grade) as integer ) as count
			from grades
			where module = $1::integer
			and semester not in (
				select semester from statistics where module = $1::integer
			)
			group by semester
		`, [module], function (err, result) {
			if (err) {
				reject(err);
			} else {
				result.rows = _.sortBy(result.rows, row => uzhSemesters.all.indexOf(row.semester)).reverse();
				resolve(result);
			}
		});
	});
};

exports.insertPredefined = function (dataset) {
	return new Promise((resolve, reject) => {
		var query = dataset.points.map(point => {
			return `
				insert into statistics
				values ('${dataset.source}', ${point.module}, ${point.average}, '${point.semester}', ${point.passed}, ${point.failed});
			`;
		}).join('\n');
		connection.query(query, function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.getPredefined = function (module) {
	return new Promise((resolve, reject) => {
		connection.query(`
				select source, module, average, passed, failed, semester from statistics
				where module = $1::integer
			`, [module], function (err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
	});
};

exports.getDistribution = function (module) {
	return new Promise((resolve, reject) => {
		const buckets = 20;
		connection.query(`
			select width_bucket(grade, 1, 6, ${buckets}) as bucket, count(*) as count
				from grades where module = $1::integer
				group by bucket
				order by bucket
		`, [module], (err, result) => {
			if (err) {
				reject(err);
			} else {
				const rows = result.rows;
				const filled = new Array(buckets).fill(1).map((j, i) => {
					const bucket = rows.find(r => r.bucket === i + 1);
					if (!bucket) {
						return 0;
					}
					return parseInt(bucket.count, 10);
				});
				const last = rows[rows.length - 1];
				const isMaximum = last.bucket === buckets + 1;
				if (isMaximum) {
					filled[buckets - 1] += parseInt(last.count, 10);
				}
				resolve(filled);
			}
		});
	});
};

exports.getAllStats = function (module) {
	return co(function *() {
		const [
			predefined,
			statsBySemester,
			totalStats,
			distribution
		] = yield Promise.all([
			exports.getPredefined(module),
			exports.getStatsBySemester(module),
			exports.getTotalStats(module),
			exports.getDistribution(module)
		]);
		var detailsCombined = statsBySemester.rows.concat(predefined.rows);
		var detailed = _.sortBy(detailsCombined, d => uzhSemesters.all.indexOf(d.semester)).reverse();
		var total = exports.reducePredefined(predefined.rows.concat(totalStats.rows));
		return {
			total: Object.assign(total, {
				median: totalStats.rows[0].median,
				stddev: totalStats.rows[0].stddev
			}),
			detailed,
			distribution
		};
	});
};

exports.deleteUser = function (student) {
	return new Promise((resolve, reject) => {
		connection.query(`
			delete from grades where student = $1::text;
		`, [student], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.addOptOut = function (student) {
	return new Promise((resolve, reject) => {
		connection.query(`
			insert into optouts
			values ($1::text, $2::timestamp);
		`, [student, new Date()], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.reducePredefined = function (predefined) {
	var passed = 0;
	var failed = 0;
	var count = 0;
	var medianCount = 0;
	var grades = 0;
	predefined.forEach(p => {
		passed += p.passed;
		failed += p.failed;
		count += (p.failed + p.passed);
		grades += p.average * (p.failed + p.passed);
	});
	return {
		passed,
		failed,
		count,
		average: count === 0 ? NaN : (Math.round(grades / count * 100) / 100)
	};
};

exports.connection = connection;
