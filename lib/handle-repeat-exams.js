const _ = require('underscore');

module.exports = function (grades) {
	const usedKeys = [];
	for (let i = 0; i < grades.length; i++) {
		const grade = grades[i];
		grade.repeated = false;
		const key = uniqueKey(grade);
		const otherIndex = _.findIndex(usedKeys, used => used.key === key);
		usedKeys.push({
			grade: Number.parseFloat(grade.grade),
			key
		});
		if (otherIndex > -1) {
			if (usedKeys[otherIndex].grade > Number.parseFloat(grade.grade)) {
				grades[otherIndex].repeated = true;
			} else {
				grade.repeated = true;
			}
		}
	}

	return grades;
};

function uniqueKey(grade) {
	return grade.semester + grade.module;
}
