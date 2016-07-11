const pg = require('pg');
const co = require('co');
const _ = require('underscore');
const uzhSemesters = require('@jonny/uzh-semesters');

process.env.PGDATABASE = process.env.PG_DATABASE || process.env.PGDATABASE;
process.env.PGUSER = process.env.PG_USER || process.env.PGUSER;

const connection = new pg.Client();

connection.connect(err => {
	if (err) {
		throw err;
	}
});

exports.reset = function () {
	return new Promise((resolve, reject) => {
		connection.query(`
			drop table if exists grades;
			drop table if exists statistics;
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
				student varchar(10) not null,
				module integer not null,
				grade real not null check (grade >= 1) check(grade <= 6),
				semester varchar(10) not null,
				unique(student, module, semester)
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
		`, function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.insertStat = function (student, module, grade, semester) {
	if (!uzhSemesters.isValid(semester)) {
		throw new Error('Invalid semester');
	}
	return new Promise((resolve, reject) => {
		connection.query(`
			insert into grades values ($1::text, $2::integer, $3::real, $4::text);
		`, [student, module, grade, semester], function (err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.getTotalStats = function (module) {
	return new Promise((resolve, reject) => {
		connection.query(`
			select
				cast(round(cast(avg(grade) as numeric), 2) as real) as average,
				cast(sum(case when grade >= 4 then 1 else 0 end) as integer) as passed,
				cast(sum(case when grade < 4 then 1 else 0 end) as integer) as failed,
				cast(count(grade) as integer) as count
			from grades
			where module = $1::integer
			and semester not in (
				select semester from statistics
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
				select semester from statistics
			)
			group by semester
		`, [module], function (err, result) {
			if (err) {
				reject(err);
			} else {
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

exports.getAllStats = function (module) {
	return co(function *() {
		var predefined = yield exports.getPredefined(module);
		var statsBySemester = yield exports.getStatsBySemester(module);
		var detailsCombined = statsBySemester.rows.concat(predefined.rows);

		var totalStats = yield exports.getTotalStats(module);

		var detailed = _.sortBy(detailsCombined, d => uzhSemesters.all.indexOf(d.semester)).reverse();
		var total = exports.reducePredefined(predefined.rows.concat(totalStats.rows));
		return {
			total,
			detailed
		};
	});
};

exports.deleteUser = function (student) {
	return new Promise((resolve, reject) => {
		connection.query(`
			delete * from grades where student = $1::text
		`, [student], function (err, result) {
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
