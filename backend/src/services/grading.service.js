const crypto = require('node:crypto');
const supabase = require('../config/supabase');
const {
    indexToDisplayLabel,
    getOrderedChoices,
    buildStudentRenderSpec
} = require('./student-exam.service');

function applyRounding(value, rule) {
    const precision = Number.isInteger(rule?.rounding_precision) ? rule.rounding_precision : 2;
    const factor = Math.pow(10, precision);
    const roundingRule = rule?.rounding_rule || 'ROUND_HALF_UP';

    if (roundingRule === 'NONE') {
        return Number(value.toFixed(2));
    }
    if (roundingRule === 'ROUND_DOWN') {
        return Number((Math.floor(value * factor + 1e-9) / factor).toFixed(2));
    }
    return Number((Math.round((value + 1e-9) * factor) / factor).toFixed(2));
}

function normalizeInputText(text, caseSensitive) {
    const normalized = String(text ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
    return caseSensitive ? normalized : normalized.toLowerCase();
}

function clampScore(score, maxScore) {
    return Number(Math.max(0, Math.min(maxScore, score)).toFixed(2));
}

function gradeQuestionItem(evq, qv, studentAnswer, rule) {
    const maxScore = Number(evq.score || 0);
    const snapshot = qv?.options_snapshot || {};
    const kind = snapshot.kind;

    let gradingStatus = 'BLANK';
    let earnedScore = 0;
    let studentResponse = {};
    let correctAnswer = {};
    const gradingDetails = {kind, scoring_mode: rule?.scoring_mode || 'EXACT_MATCH'};

    switch (kind) {
        case 'SINGLE_CHOICE': {
            const orderedChoices = getOrderedChoices(snapshot, evq.option_order);
            const labelToChoice = new Map();
            const idToLabel = new Map();
            const correctLabels = [];

            orderedChoices.forEach((c, idx) => {
                const label = indexToDisplayLabel(idx);
                labelToChoice.set(label, c);
                idToLabel.set(String(c.id), label);
                if (c.is_correct) {
                    correctLabels.push(label);
                }
            });

            const rawSelected = Array.isArray(studentAnswer?.selected_options) ? studentAnswer.selected_options : [];
            const normalizedSelected = rawSelected.map(opt => idToLabel.get(String(opt)) || String(opt));

            studentResponse = {selected_options: normalizedSelected};
            correctAnswer = {correct_options: correctLabels};

            if (normalizedSelected.length === 0) {
                gradingStatus = 'BLANK';
                earnedScore = 0;
            } else if (normalizedSelected.length === 1 && correctLabels.includes(normalizedSelected[0])) {
                gradingStatus = 'CORRECT';
                earnedScore = maxScore;
            } else {
                gradingStatus = 'WRONG';
                earnedScore = 0;
            }
            break;
        }

        case 'MULTI_CHOICE': {
            const orderedChoices = getOrderedChoices(snapshot, evq.option_order);
            const labelToId = new Map();
            const idToLabel = new Map();
            const correctIdSet = new Set();
            const correctLabels = [];

            orderedChoices.forEach((c, idx) => {
                const label = indexToDisplayLabel(idx);
                const cid = String(c.id);
                labelToId.set(label, cid);
                idToLabel.set(cid, label);
                if (c.is_correct) {
                    correctIdSet.add(cid);
                    correctLabels.push(label);
                }
            });

            const rawSelected = Array.isArray(studentAnswer?.selected_options) ? studentAnswer.selected_options : [];
            const selectedIds = new Set();
            const normalizedSelected = [];
            for (const opt of rawSelected) {
                const s = String(opt);
                if (labelToId.has(s)) {
                    selectedIds.add(labelToId.get(s));
                    normalizedSelected.push(s);
                } else if (idToLabel.has(s)) {
                    selectedIds.add(s);
                    normalizedSelected.push(idToLabel.get(s));
                } else {
                    selectedIds.add(s);
                    normalizedSelected.push(s);
                }
            }

            studentResponse = {selected_options: normalizedSelected};
            correctAnswer = {correct_options: correctLabels};

            if (selectedIds.size === 0) {
                gradingStatus = 'BLANK';
                earnedScore = 0;
            } else {
                let correctPicked = 0;
                let wrongPicked = 0;
                for (const id of selectedIds) {
                    if (correctIdSet.has(id)) correctPicked++;
                    else wrongPicked++;
                }

                if (correctPicked === correctIdSet.size && wrongPicked === 0) {
                    gradingStatus = 'CORRECT';
                    earnedScore = maxScore;
                } else if (rule?.scoring_mode === 'PARTIAL_CREDIT' && correctPicked > 0 && correctIdSet.size > 0) {
                    const penaltyFactor = rule.penalty_for_wrong === false ? 0 : 1;
                    const ratio = Math.max(0, (correctPicked - penaltyFactor * wrongPicked) / correctIdSet.size);
                    earnedScore = clampScore(applyRounding(maxScore * ratio, rule), maxScore);
                    gradingStatus = earnedScore > 0 ? 'PARTIAL' : 'WRONG';
                } else {
                    gradingStatus = 'WRONG';
                    earnedScore = 0;
                }
                gradingDetails.correct_picked = correctPicked;
                gradingDetails.wrong_picked = wrongPicked;
                gradingDetails.expected_count = correctIdSet.size;
            }
            break;
        }

        case 'DROPDOWN': {
            const blanks = Array.isArray(snapshot.blanks) ? snapshot.blanks : [];
            const selections = Array.isArray(studentAnswer?.response_data?.selections)
                ? studentAnswer.response_data.selections
                : [];
            const selMap = new Map(selections.map(s => [s.blank_id, s.value_id]));

            studentResponse = {selections};
            correctAnswer = {
                blanks: blanks.map(b => ({blank_id: b.blank_id, correct_value_id: b.correct_value_id}))
            };

            if (selections.length === 0) {
                gradingStatus = 'BLANK';
                earnedScore = 0;
            } else {
                let matched = 0;
                for (const b of blanks) {
                    if (selMap.get(b.blank_id) === b.correct_value_id) {
                        matched++;
                    }
                }
                if (matched === blanks.length && blanks.length > 0) {
                    gradingStatus = 'CORRECT';
                    earnedScore = maxScore;
                } else if (rule?.scoring_mode === 'PARTIAL_CREDIT' && matched > 0 && blanks.length > 0) {
                    earnedScore = clampScore(applyRounding(maxScore * (matched / blanks.length), rule), maxScore);
                    gradingStatus = earnedScore > 0 ? 'PARTIAL' : 'WRONG';
                } else {
                    gradingStatus = 'WRONG';
                    earnedScore = 0;
                }
                gradingDetails.matched_blanks = matched;
                gradingDetails.total_blanks = blanks.length;
            }
            break;
        }

        case 'INPUT': {
            const equivalentAnswers = Array.isArray(snapshot.equivalent_answers) ? snapshot.equivalent_answers : [];
            const rawText = typeof studentAnswer?.answer_text === 'string'
                ? studentAnswer.answer_text.normalize('NFC').trim().replace(/\s+/g, ' ')
                : '';
            const caseSensitive = Boolean(rule?.case_sensitive);

            studentResponse = {answer_text: rawText || null};
            correctAnswer = {equivalent_answers: equivalentAnswers};

            if (!rawText) {
                gradingStatus = 'BLANK';
                earnedScore = 0;
            } else {
                const candidateNorm = normalizeInputText(rawText, caseSensitive);
                const matched = equivalentAnswers.some(ans => normalizeInputText(ans, caseSensitive) === candidateNorm);
                if (matched) {
                    gradingStatus = 'CORRECT';
                    earnedScore = maxScore;
                } else {
                    gradingStatus = 'WRONG';
                    earnedScore = 0;
                }
            }
            break;
        }

        case 'MATCHING': {
            const expectedPairs = Array.isArray(snapshot.pairs) ? snapshot.pairs : [];
            const studentPairs = Array.isArray(studentAnswer?.response_data?.pairs)
                ? studentAnswer.response_data.pairs
                : [];
            const studentMap = new Map(studentPairs.map(p => [p.left_id, p.right_id]));

            studentResponse = {pairs: studentPairs};
            correctAnswer = {
                pairs: expectedPairs.map(p => ({left_id: p.left_id, right_id: p.right_id}))
            };

            if (studentPairs.length === 0) {
                gradingStatus = 'BLANK';
                earnedScore = 0;
            } else {
                let matched = 0;
                for (const p of expectedPairs) {
                    if (studentMap.get(p.left_id) === p.right_id) {
                        matched++;
                    }
                }
                if (matched === expectedPairs.length && studentPairs.length === expectedPairs.length && expectedPairs.length > 0) {
                    gradingStatus = 'CORRECT';
                    earnedScore = maxScore;
                } else if (rule?.scoring_mode === 'PARTIAL_CREDIT' && matched > 0 && expectedPairs.length > 0) {
                    earnedScore = clampScore(applyRounding(maxScore * (matched / expectedPairs.length), rule), maxScore);
                    gradingStatus = earnedScore > 0 ? 'PARTIAL' : 'WRONG';
                } else {
                    gradingStatus = 'WRONG';
                    earnedScore = 0;
                }
                gradingDetails.matched_pairs = matched;
                gradingDetails.total_pairs = expectedPairs.length;
            }
            break;
        }

        default: {
            gradingStatus = 'BLANK';
            earnedScore = 0;
            break;
        }
    }

    return {
        grading_status: gradingStatus,
        max_score: maxScore,
        earned_score: clampScore(earnedScore, maxScore),
        answer_snapshot: studentResponse,
        correct_answer_snapshot: correctAnswer,
        grading_rule_snapshot: rule || null,
        grading_details: gradingDetails
    };
}

async function gradeSubmission(submissionId, {gradedBy = null, forceRegrade = false} = {}) {
    const {data: submission, error: subErr} = await supabase
        .from('submissions')
        .select('id, participant_id, exam_id, variant_id, source, status')
        .eq('id', submissionId)
        .maybeSingle();

    if (subErr) throw subErr;
    if (!submission) {
        const err = new Error('Submission not found.');
        err.code = 'SUBMISSION_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (submission.status === 'GRADED' && !forceRegrade) {
        const {data: existingGrade} = await supabase
            .from('grades')
            .select('*')
            .eq('submission_id', submissionId)
            .maybeSingle();
        if (existingGrade) {
            return existingGrade;
        }
    }

    if (!['SUBMITTED', 'GRADING', 'GRADED'].includes(submission.status)) {
        const err = new Error(`Cannot grade submission in status ${submission.status}.`);
        err.code = 'INVALID_SUBMISSION_STATUS';
        err.status = 409;
        throw err;
    }

    if (!submission.variant_id) {
        const err = new Error('Submission has no assigned variant_id.');
        err.code = 'VARIANT_NOT_ASSIGNED';
        err.status = 409;
        throw err;
    }

    const {data: exam, error: examErr} = await supabase
        .from('exams')
        .select('id, total_questions, total_score')
        .eq('id', submission.exam_id)
        .single();

    if (examErr) throw examErr;

    const {data: rulesRows, error: rulesErr} = await supabase
        .from('exam_grading_rules')
        .select('question_type_id, scoring_mode, allow_negative_marking, penalty_for_wrong, case_sensitive, rounding_precision, rounding_rule')
        .eq('exam_id', submission.exam_id)
        .is('deleted_at', null);

    if (rulesErr) throw rulesErr;
    const ruleByTypeId = new Map((rulesRows ?? []).map(r => [r.question_type_id, r]));

    const {data: evqRows, error: evqErr} = await supabase
        .from('exam_variant_questions')
        .select(`
            id,
            position_in_variant,
            option_order,
            score,
            question_versions!inner (
                id,
                type_id,
                content,
                explanation,
                options_snapshot
            )
        `)
        .eq('variant_id', submission.variant_id)
        .order('position_in_variant', {ascending: true});

    if (evqErr) throw evqErr;

    const {data: answerRows, error: ansErr} = await supabase
        .from('student_answers')
        .select('exam_variant_question_id, selected_options, answer_text, response_data')
        .eq('submission_id', submissionId);

    if (ansErr) throw ansErr;
    const answersByEvqId = new Map((answerRows ?? []).map(a => [a.exam_variant_question_id, a]));

    const {data: existingSagRows, error: sagIterErr} = await supabase
        .from('submission_answer_grades')
        .select('iteration')
        .eq('submission_id', submissionId)
        .order('iteration', {ascending: false})
        .limit(1);

    if (sagIterErr) throw sagIterErr;
    const nextIteration = existingSagRows && existingSagRows.length > 0
        ? Number(existingSagRows[0].iteration) + 1
        : 1;

    const now = new Date().toISOString();
    const sagInserts = [];
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;

    for (const evq of evqRows ?? []) {
        const qv = Array.isArray(evq.question_versions) ? evq.question_versions[0] : evq.question_versions;
        const rule = ruleByTypeId.get(qv.type_id) || null;
        const studentAnswer = answersByEvqId.get(evq.id) || null;

        const graded = gradeQuestionItem(evq, qv, studentAnswer, rule);

        totalScore = Number((totalScore + graded.earned_score).toFixed(2));
        if (graded.grading_status === 'CORRECT') correctCount++;
        else if (graded.grading_status === 'BLANK') blankCount++;
        else wrongCount++;

        sagInserts.push({
            id: crypto.randomUUID(),
            submission_id: submissionId,
            exam_variant_question_id: evq.id,
            answer_snapshot: graded.answer_snapshot,
            correct_answer_snapshot: graded.correct_answer_snapshot,
            grading_rule_snapshot: graded.grading_rule_snapshot,
            grading_status: graded.grading_status,
            max_score: graded.max_score,
            earned_score: graded.earned_score,
            grading_details: graded.grading_details,
            iteration: nextIteration,
            is_final: true,
            graded_by: gradedBy,
            graded_at: now
        });
    }

    if (sagInserts.length !== Number(exam.total_questions)) {
        const err = new Error(
            `Variant question count (${sagInserts.length}) does not match exam total_questions (${exam.total_questions}).`
        );
        err.code = 'GRADE_COUNT_MISMATCH';
        err.status = 409;
        throw err;
    }

    const {error: sagInsertErr} = await supabase
        .from('submission_answer_grades')
        .insert(sagInserts);

    if (sagInsertErr) throw sagInsertErr;

    const {data: existingGrade, error: findGradeErr} = await supabase
        .from('grades')
        .select('id')
        .eq('submission_id', submissionId)
        .maybeSingle();

    if (findGradeErr) throw findGradeErr;

    let gradeRecord = null;
    if (existingGrade) {
        const {data: updatedGrade, error: updGradeErr} = await supabase
            .from('grades')
            .update({
                total_score: totalScore,
                correct_count: correctCount,
                wrong_count: wrongCount,
                blank_count: blankCount,
                graded_by: gradedBy,
                graded_at: now,
                updated_at: now
            })
            .eq('id', existingGrade.id)
            .select('*')
            .single();
        if (updGradeErr) throw updGradeErr;
        gradeRecord = updatedGrade;
    } else {
        const {data: insertedGrade, error: insGradeErr} = await supabase
            .from('grades')
            .insert({
                id: crypto.randomUUID(),
                submission_id: submissionId,
                total_score: totalScore,
                correct_count: correctCount,
                wrong_count: wrongCount,
                blank_count: blankCount,
                graded_by: gradedBy,
                graded_at: now,
                created_at: now,
                updated_at: now
            })
            .select('*')
            .single();
        if (insGradeErr) throw insGradeErr;
        gradeRecord = insertedGrade;
    }

    if (submission.status !== 'GRADED') {
        const {error: subUpdErr} = await supabase
            .from('submissions')
            .update({
                status: 'GRADED',
                raw_score: totalScore,
                updated_at: now
            })
            .eq('id', submissionId);
        if (subUpdErr) throw subUpdErr;
    } else {
        const {error: subScoreErr} = await supabase
            .from('submissions')
            .update({
                raw_score: totalScore,
                updated_at: now
            })
            .eq('id', submissionId);
        if (subScoreErr) throw subScoreErr;
    }

    return gradeRecord;
}

async function gradePendingOnlineSubmissionsForExam(examId, {gradedBy = null} = {}) {
    const {data: pendingSubs, error} = await supabase
        .from('submissions')
        .select('id, source, status')
        .eq('exam_id', examId)
        .eq('source', 'ONLINE')
        .in('status', ['SUBMITTED', 'GRADING']);

    if (error) throw error;

    const subs = pendingSubs ?? [];
    for (let i = 0; i < subs.length; i += 5) {
        const chunk = subs.slice(i, i + 5);
        await Promise.all(chunk.map(sub => gradeSubmission(sub.id, {gradedBy})));
    }
}

module.exports = {
    gradeQuestionItem,
    gradeSubmission,
    gradePendingOnlineSubmissionsForExam,
    buildStudentRenderSpec
};
