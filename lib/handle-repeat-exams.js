var _ = require('underscore');

module.exports = function (grades) {
	var usedKeys = [];
	for (let i = 0; i < grades.length; i++) {
		let grade = grades[i];
		grade.repeated = false;
		let key = uniqueKey(grade);
		let otherIndex = _.findIndex(usedKeys, used => used.key === key);
		usedKeys.push({
			grade: parseFloat(grade.grade),
			key
		});
		if (otherIndex > -1) {
			if (usedKeys[otherIndex].grade > parseFloat(grade.grade)) {
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
