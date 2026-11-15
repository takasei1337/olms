/**
 * Validate whether an exam's scheduled opening window has started.
 * @param {object} exam - Exam record with opens_at ISO timestamp
 */
function requireExamOpened(exam) {
    if (Date.now() < Date.parse(exam.opens_at)) {
        const error = new Error('The exam cannot start before opens_at.');
        error.code = 'EXAM_NOT_OPEN';
        error.status = 409;
        throw error;
    }
}

module.exports = {
    requireExamOpened
};
