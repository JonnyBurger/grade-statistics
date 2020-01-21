const pg = require("pg");
const co = require("co");
const _ = require("underscore");
const uzhSemesters = require("@jonny/uzh-semesters");
const isMd5 = require("is-md5");

process.env.PGDATABASE = process.env.PG_DATABASE || process.env.PGDATABASE;
process.env.PGUSER = process.env.PG_USER || process.env.PGUSER;

const connection = new pg.Client();

connection.connect(err => {
	if (err) {
		throw err;
	}
});

exports.reset = function() {
	if (process.env.PGHOST.indexOf(".ch") !== -1) {
		throw new Error("Do not reset prod db!");
	}
	if (
		process.env.PGHOST.indexOf("46.101.96.149") !== -1 &&
		process.env.PGDATABASE.indexOf("bestande") !== -1
	) {
		throw new Error("Do not reset prod db!");
	}
	return new Promise((resolve, reject) => {
		connection.query(
			`
			drop table if exists grades;
			drop table if exists statistics;
			drop table if exists optouts;
		`,
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.createIndices = function() {
	return new Promise((resolve, reject) => {
		connection.query(
			`
		DO $$
			BEGIN
			     BEGIN
		            create index studentIndex on public.grades (student);
		        EXCEPTION
		            WHEN duplicate_table then RAISE NOTICE 'studentIndex already exists';
		        END;
		    END;
		$$;
		DO $$
			BEGIN
			     BEGIN
		            create index moduleIndex on public.grades (module, institution);
		        EXCEPTION
		            WHEN duplicate_table then RAISE NOTICE 'moduleIndex exists';
		        END;
		    END;
		$$;
		DO $$
			BEGIN
			     BEGIN
		            create index moduleSemesterIndex on public.grades (module, institution, semester);
		        EXCEPTION
		            WHEN duplicate_table then RAISE NOTICE 'moduleSemesterIndex exists';
		        END;
		    END;
		$$;
		`,
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.createTables = function() {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			create table if not exists grades (
				student char(32) not null,
				module integer not null,
				grade real not null check (grade >= 1) check(grade <= 6),
				semester varchar(10) not null,
				is_repeated boolean not null,
				unique(student, module, semester, is_repeated)
			);
			alter table grades alter column module type varchar(15);
			DO $$
			    BEGIN
			        BEGIN
			            ALTER TABLE grades ADD COLUMN institution varchar(8) not null default 'UZH';
			        EXCEPTION
			            WHEN duplicate_column THEN RAISE NOTICE 'column institution already exists in grades.';
			        END;
			    END;
			$$;
			alter table grades
				drop constraint grades_student_module_semester_is_repeated_key;
			alter table grades
				add constraint grades_student_module_semester_is_repeated_key UNIQUE(student, module, semester, is_repeated, institution);
			create table if not exists statistics (
				source varchar(255) not null,
				module varchar(15) not null,
				average real not null,
				semester varchar(10) not null,
				passed integer not null,
				failed integer not null,
				unique(module, semester)
			);
			alter table statistics alter column module type varchar(15);
			DO $$
			    BEGIN
			        BEGIN
			            ALTER TABLE statistics ADD COLUMN institution varchar(8) not null default 'UZH';
			        EXCEPTION
			            WHEN duplicate_column THEN RAISE NOTICE 'column institution already exists in statistics.';
			        END;
			    END;
			$$;
			DO $$
			    BEGIN
			        BEGIN
			            ALTER TABLE statistics ADD COLUMN stddev real default null;
			        EXCEPTION
			            WHEN duplicate_column THEN RAISE NOTICE 'column stddev already exists in statistics.';
			        END;
			    END;
			$$;
			DO $$
			    BEGIN
			        BEGIN
			            ALTER TABLE statistics ADD COLUMN source_link varchar(255) default null;
			        EXCEPTION
			            WHEN duplicate_column THEN RAISE NOTICE 'column source_link already exists in statistics.';
			        END;
			    END;
			$$;
			DO $$
			    BEGIN
			        BEGIN
			            ALTER TABLE statistics ADD COLUMN comment varchar(255) default null;
			        EXCEPTION
			            WHEN duplicate_column THEN RAISE NOTICE 'column comment already exists in statistics.';
			        END;
			    END;
			$$;
			alter table statistics
				drop constraint statistics_module_semester_key;
			alter table statistics
				add constraint statistics_module_semester_key UNIQUE(module, semester, institution);
			create table if not exists optouts (
				student char(32) not null,
				date timestamp not null
			);
			DO $$
			    BEGIN
			        BEGIN
			            ALTER TABLE optouts ADD COLUMN institution varchar(8) not null default 'UZH';
			        EXCEPTION
			            WHEN duplicate_column THEN RAISE NOTICE 'column institution already exists in optouts.';
			        END;
			    END;
			$$;
		`,
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.insertStat = function(
	student,
	module,
	grade,
	semester,
	repeated,
	institution
) {
	if (!uzhSemesters.isValid(semester)) {
		throw new Error("Invalid semester");
	}
	if (!isMd5(student)) {
		throw new Error("Student should be a MD5 hash");
	}
	if (student === "f791a235e89700b87a69d26ac8f10d71") {
		throw new Error("Der Demo-Account kann diese Aktion nicht ausführen");
	}
	if (student === "d41d8cd98f00b204e9800998ecf8427e") {
		throw new Error("Ungültiger Benutzername");
	}
	return new Promise((resolve, reject) => {
		connection.query(
			`
			insert into grades values ($1::text, $2::text, $3::real, $4::text, $5::boolean, $6::text);
		`,
			[student, module, grade, semester, repeated, institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.insertStats = function(grades) {
	let i = 0;
	const values = [];
	const mappedGrades = grades.map(g => {
		const [student, module, grade, semester, repeated, institution] = g;

		if (!uzhSemesters.isValid(semester)) {
			throw new Error("Invalid semester");
		}
		if (!isMd5(student)) {
			throw new Error("Student should be a MD5 hash");
		}
		if (student === "f791a235e89700b87a69d26ac8f10d71") {
			throw new Error("Der Demo-Account kann diese Aktion nicht ausführen");
		}
		if (student === "d41d8cd98f00b204e9800998ecf8427e") {
			throw new Error("Ungültiger Benutzername");
		}
		values.push(student);
		values.push(module);
		values.push(grade);
		values.push(semester);
		values.push(repeated);
		values.push(institution);
		return `($${++i}::text, $${++i}::text, $${++i}::real, $${++i}::text, $${++i}::boolean, $${++i}::text)`;
	});

	const query = `
		with data(student, module, grade, semester, is_repeated, institution) as (
		values ${mappedGrades.join(",\n")}
		)

		insert into grades (student, module, grade, semester, is_repeated, institution)
		select g.student, g.module, g.grade, g.semester, g.is_repeated, g.institution
		from data g
		where not exists (
			select 1 from grades g2
			where g2.student = g.student
			and g2.module = g.module
			and g2.semester = g.semester
			and g2.is_repeated = g.is_repeated
		)
	`;

	return new Promise((resolve, reject) => {
		connection.query(query, values, function(err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.studentIsOptedIn = function(student, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			select student from grades
			where student = $1::text
			and institution = $2::text
			limit 1
		`,
			[student, institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(Boolean(result.rows.length));
				}
			}
		);
	});
};

exports.studentOptOutCount = function(student, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			select cast(count(*) as integer) from optouts
			where student = $1::text
			and institution = $2::text
		`,
			[student, institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result.rows[0].count);
				}
			}
		);
	});
};

exports.getTotalStats = function(module, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			select
				cast(round(cast(avg(grade) as numeric), 2) as real) as average,
				cast(round(cast(median(grade) as numeric), 2) as real) as median,
				cast(round(cast(stddev_samp(grade) as numeric), 2) as real) as stddev,
				cast(sum(case when grade >= 4 then 1 else 0 end) as integer) as passed,
				cast(sum(case when grade < 4 then 1 else 0 end) as integer) as failed,
				cast(count(grade) as integer) as count
			from grades
			where module = $1::text
			and institution = $2::text
			and semester not in (
				select semester from statistics where module = $1::text
			)
		`,
			[String(module), institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.getStatsBySemester = function(module, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			select
				cast(round(cast(avg(grade) as numeric), 2) as real) as average,
				semester,
				cast(sum(case when grade >= 4 then 1 else 0 end) as integer) as passed,
				cast(sum(case when grade < 4  then 1 else 0 end) as integer) as failed,
				cast(count(grade) as integer ) as count
			from grades
			where module = $1::text
			and institution = $2::text
			and semester not in (
				select semester from statistics where module = $1::text
			)
			group by semester
		`,
			[String(module), institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					result.rows = _.sortBy(result.rows, row =>
						uzhSemesters.all.indexOf(row.semester)
					).reverse();
					resolve(result);
				}
			}
		);
	});
};

exports.insertPredefined = function(dataset) {
	return new Promise((resolve, reject) => {
		var query = `
				insert into statistics
				values ('${dataset.source}', ${dataset.module}, ${dataset.average}, '${
			dataset.semester
		}', ${dataset.passed}, ${dataset.failed}, '${
			dataset.institution
		}' , ${dataset.stddev || "null"}, ${
			dataset.source_link ? `'${dataset.source_link}'` : "null"
		}, ${dataset.comment ? `'${dataset.comment}'` : "null"} );
			`;
		connection.query(query, function(err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

exports.getPredefined = function(module, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
				select source, module, average, passed, failed, semester, stddev, source_link, comment from statistics
				where module = $1::text
				and institution = $2::text
			`,
			[String(module), institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.getDistribution = function(module, institution) {
	return new Promise((resolve, reject) => {
		const buckets = 20;
		connection.query(
			`
			select width_bucket(grade, 1, 6, ${buckets}) as bucket, count(*) as count
				from grades
				where module = $1::text
				and institution = $2::text
				group by bucket
				order by bucket
		`,
			[String(module), institution],
			(err, result) => {
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
					if (rows.length === 0) {
						return resolve(filled);
					}
					const last = rows[rows.length - 1];
					const isMaximum = last.bucket === buckets + 1;
					if (isMaximum) {
						filled[buckets - 1] += parseInt(last.count, 10);
					}
					resolve(filled);
				}
			}
		);
	});
};

const aboutToMap = {};
const cache = {};

exports.getAllStats = function(module, institution) {
	if (aboutToMap[module + institution]) {
		while (!cache[module + institution]) {
			yield new Promise(resolve => setTimeout(() => resolve(), 1000))
		}
		return cache[module + institution]
	}
	return co(function*() {
		aboutToMap[module + institution] = true;
		const [
			predefined,
			statsBySemester,
			totalStats,
			distribution
		] = yield Promise.all([
			exports.getPredefined(module, institution),
			exports.getStatsBySemester(module, institution),
			exports.getTotalStats(module, institution),
			exports.getDistribution(module, institution)
		]);
		var detailsCombined = statsBySemester.rows.concat(predefined.rows);
		var detailed = _.sortBy(detailsCombined, d =>
			uzhSemesters.all.indexOf(d.semester)
		).reverse();
		var total = exports.reducePredefined(
			predefined.rows.concat(totalStats.rows)
		);
		const response = {
			total: Object.assign(total, {
				median: totalStats.rows[0].median || 0,
				stddev: totalStats.rows[0].stddev
			}),
			detailed,
			distribution
		};
		cache[module + institution] = response;
		return response;
	});
};

exports.deleteUser = function(student, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			delete from grades
			where student = $1::text
			and institution = $2::text;
		`,
			[student, institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.addOptOut = function(student, institution) {
	return new Promise((resolve, reject) => {
		connection.query(
			`
			insert into optouts
			values ($1::text, $2::timestamp, $3::text);
		`,
			[student, new Date(), institution],
			function(err, result) {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
};

exports.reducePredefined = function(predefined) {
	var passed = 0;
	var failed = 0;
	var count = 0;
	var grades = 0;
	predefined.forEach(p => {
		passed += p.passed;
		failed += p.failed;
		count += p.failed + p.passed;
		grades += p.average * (p.failed + p.passed);
	});
	return {
		passed,
		failed,
		count,
		average: count === 0 ? NaN : Math.round((grades / count) * 100) / 100
	};
};

exports.connection = connection;
