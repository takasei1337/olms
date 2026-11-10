const {UUID_REGEX} = require('./answer-spec.validator');

const VALID_EXAM_STATUSES = [
    'DRAFT',
    'GENERATED',
    'PUBLISHED',
    'IN_PROGRESS',
    'ENDED',
    'RESULT_PUBLISHED',
    'ARCHIVED',
    'CANCELLED'
];

const VALID_DELIVERY_MODES = ['ONLINE', 'PAPER', 'BOTH'];
const VALID_VISIBILITY_MODES = ['HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'];
const VALID_DIFFICULTY_LEVELS = ['EASY', 'MEDIUM', 'HARD'];
const VALID_SCORING_MODES = ['EXACT_MATCH', 'PARTIAL_CREDIT'];
const VALID_ROUNDING_RULES = ['ROUND_HALF_UP', 'ROUND_DOWN', 'NONE'];

function validateCreateExamBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = [
        'code',
        'name',
        'subject_id',
        'delivery_mode',
        'total_questions',
        'duration_minutes',
        'opens_at',
        'closes_at',
        'total_score',
        'result_visibility_mode',
        'form_template_id'
    ];

    const unsupported = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (typeof body.code !== 'string' || !body.code.trim()) {
        return 'code is required and must be a non-empty string.';
    }
    if (body.code.trim().length > 30) {
        return 'code must not exceed 30 characters.';
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return 'name is required and must be a non-empty string.';
    }
    if (body.name.trim().length > 200) {
        return 'name must not exceed 200 characters.';
    }

    if (typeof body.subject_id !== 'string' || !UUID_REGEX.test(body.subject_id)) {
        return 'subject_id is required and must be a valid UUID.';
    }

    if (typeof body.delivery_mode !== 'string' || !VALID_DELIVERY_MODES.includes(body.delivery_mode)) {
        return `delivery_mode is required and must be one of: ${VALID_DELIVERY_MODES.join(', ')}.`;
    }

    if (!Number.isInteger(body.total_questions) || body.total_questions < 1) {
        return 'total_questions is required and must be an integer >= 1.';
    }

    if (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 1) {
        return 'duration_minutes is required and must be an integer >= 1.';
    }

    if (typeof body.opens_at !== 'string' || Number.isNaN(Date.parse(body.opens_at))) {
        return 'opens_at is required and must be a valid ISO 8601 date string.';
    }

    if (typeof body.closes_at !== 'string' || Number.isNaN(Date.parse(body.closes_at))) {
        return 'closes_at is required and must be a valid ISO 8601 date string.';
    }

    if (new Date(body.closes_at) <= new Date(body.opens_at)) {
        return 'closes_at must be strictly after opens_at.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'total_score')) {
        if (typeof body.total_score !== 'number' || body.total_score <= 0) {
            return 'total_score must be a positive number.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'result_visibility_mode')) {
        if (!VALID_VISIBILITY_MODES.includes(body.result_visibility_mode)) {
            return `result_visibility_mode must be one of: ${VALID_VISIBILITY_MODES.join(', ')}.`;
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'form_template_id') && body.form_template_id !== null) {
        if (typeof body.form_template_id !== 'string' || !UUID_REGEX.test(body.form_template_id)) {
            return 'form_template_id must be a valid UUID or null.';
        }
    }

    if (['PAPER', 'BOTH'].includes(body.delivery_mode) && !body.form_template_id) {
        return 'form_template_id is required when delivery_mode is PAPER or BOTH.';
    }

    return null;
}

function validatePatchExamBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = [
        'code',
        'name',
        'subject_id',
        'delivery_mode',
        'total_questions',
        'duration_minutes',
        'opens_at',
        'closes_at',
        'total_score',
        'result_visibility_mode',
        'form_template_id'
    ];

    const unsupported = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (Object.keys(body).length === 0) {
        return 'At least one field is required for update.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'code')) {
        if (typeof body.code !== 'string' || !body.code.trim()) {
            return 'code must be a non-empty string.';
        }
        if (body.code.trim().length > 30) {
            return 'code must not exceed 30 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return 'name must be a non-empty string.';
        }
        if (body.name.trim().length > 200) {
            return 'name must not exceed 200 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'subject_id')) {
        if (typeof body.subject_id !== 'string' || !UUID_REGEX.test(body.subject_id)) {
            return 'subject_id must be a valid UUID.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'delivery_mode')) {
        if (!VALID_DELIVERY_MODES.includes(body.delivery_mode)) {
            return `delivery_mode must be one of: ${VALID_DELIVERY_MODES.join(', ')}.`;
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'total_questions')) {
        if (!Number.isInteger(body.total_questions) || body.total_questions < 1) {
            return 'total_questions must be an integer >= 1.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'duration_minutes')) {
        if (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 1) {
            return 'duration_minutes must be an integer >= 1.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'opens_at')) {
        if (typeof body.opens_at !== 'string' || Number.isNaN(Date.parse(body.opens_at))) {
            return 'opens_at must be a valid ISO 8601 date string.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'closes_at')) {
        if (typeof body.closes_at !== 'string' || Number.isNaN(Date.parse(body.closes_at))) {
            return 'closes_at must be a valid ISO 8601 date string.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'total_score')) {
        if (typeof body.total_score !== 'number' || body.total_score <= 0) {
            return 'total_score must be a positive number.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'result_visibility_mode')) {
        if (!VALID_VISIBILITY_MODES.includes(body.result_visibility_mode)) {
            return `result_visibility_mode must be one of: ${VALID_VISIBILITY_MODES.join(', ')}.`;
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'form_template_id') && body.form_template_id !== null) {
        if (typeof body.form_template_id !== 'string' || !UUID_REGEX.test(body.form_template_id)) {
            return 'form_template_id must be a valid UUID or null.';
        }
    }

    return null;
}

function validateMatrixReplaceBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowed = ['rows'];
    const unsupported = Object.keys(body).filter(k => !allowed.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
        return 'rows must be a non-empty array.';
    }

    for (let i = 0; i < body.rows.length; i++) {
        const r = body.rows[i];
        if (!r || typeof r !== 'object' || Array.isArray(r)) {
            return `Row at index ${i} must be a JSON object.`;
        }

        const rowAllowed = [
            'chapter_id',
            'lesson_id',
            'question_type_id',
            'difficulty_level',
            'num_questions',
            'score_per_question'
        ];
        const rowUnsupported = Object.keys(r).filter(k => !rowAllowed.includes(k));
        if (rowUnsupported.length > 0) {
            return `Row at index ${i} contains unsupported fields.`;
        }

        if (typeof r.question_type_id !== 'string' || !UUID_REGEX.test(r.question_type_id)) {
            return `Row at index ${i} question_type_id is required and must be a valid UUID.`;
        }

        if (typeof r.difficulty_level !== 'string' || !VALID_DIFFICULTY_LEVELS.includes(r.difficulty_level)) {
            return `Row at index ${i} difficulty_level must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}.`;
        }

        if (!Number.isInteger(r.num_questions) || r.num_questions < 1) {
            return `Row at index ${i} num_questions must be an integer >= 1.`;
        }

        if (typeof r.score_per_question !== 'number' || r.score_per_question <= 0) {
            return `Row at index ${i} score_per_question must be a positive number.`;
        }

        if (Object.prototype.hasOwnProperty.call(r, 'chapter_id') && r.chapter_id !== null) {
            if (typeof r.chapter_id !== 'string' || !UUID_REGEX.test(r.chapter_id)) {
                return `Row at index ${i} chapter_id must be a valid UUID or null.`;
            }
        }

        if (Object.prototype.hasOwnProperty.call(r, 'lesson_id') && r.lesson_id !== null) {
            if (typeof r.lesson_id !== 'string' || !UUID_REGEX.test(r.lesson_id)) {
                return `Row at index ${i} lesson_id must be a valid UUID or null.`;
            }
            if (!r.chapter_id) {
                return `Row at index ${i} chapter_id is required when lesson_id is specified.`;
            }
        }
    }

    return null;
}

function validateGradingRulesReplaceBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowed = ['rules'];
    const unsupported = Object.keys(body).filter(k => !allowed.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (!Array.isArray(body.rules) || body.rules.length === 0) {
        return 'rules must be a non-empty array.';
    }

    for (let i = 0; i < body.rules.length; i++) {
        const rule = body.rules[i];
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            return `Rule at index ${i} must be a JSON object.`;
        }

        const ruleAllowed = [
            'question_type_id',
            'scoring_mode',
            'penalty_for_wrong',
            'case_sensitive',
            'rounding_precision',
            'rounding_rule',
            'allow_negative_marking'
        ];

        const ruleUnsupported = Object.keys(rule).filter(k => !ruleAllowed.includes(k));
        if (ruleUnsupported.length > 0) {
            return `Rule at index ${i} contains unsupported fields.`;
        }

        if (typeof rule.question_type_id !== 'string' || !UUID_REGEX.test(rule.question_type_id)) {
            return `Rule at index ${i} question_type_id is required and must be a valid UUID.`;
        }

        if (typeof rule.scoring_mode !== 'string' || !VALID_SCORING_MODES.includes(rule.scoring_mode)) {
            return `Rule at index ${i} scoring_mode must be one of: ${VALID_SCORING_MODES.join(', ')}.`;
        }

        if (Object.prototype.hasOwnProperty.call(rule, 'penalty_for_wrong')) {
            if (typeof rule.penalty_for_wrong !== 'boolean') {
                return `Rule at index ${i} penalty_for_wrong must be a boolean.`;
            }
        }

        if (Object.prototype.hasOwnProperty.call(rule, 'case_sensitive')) {
            if (typeof rule.case_sensitive !== 'boolean') {
                return `Rule at index ${i} case_sensitive must be a boolean.`;
            }
        }

        if (Object.prototype.hasOwnProperty.call(rule, 'rounding_precision')) {
            if (!Number.isInteger(rule.rounding_precision) || rule.rounding_precision < 0 || rule.rounding_precision > 4) {
                return `Rule at index ${i} rounding_precision must be an integer between 0 and 4.`;
            }
        }

        if (Object.prototype.hasOwnProperty.call(rule, 'rounding_rule')) {
            if (!VALID_ROUNDING_RULES.includes(rule.rounding_rule)) {
                return `Rule at index ${i} rounding_rule must be one of: ${VALID_ROUNDING_RULES.join(', ')}.`;
            }
        }

        if (Object.prototype.hasOwnProperty.call(rule, 'allow_negative_marking')) {
            if (rule.allow_negative_marking !== false) {
                return `Rule at index ${i} negative marking is not permitted.`;
            }
        }
    }

    return null;
}

function validateGenerateExamBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['variant_count', 'variant_code_start'];
    const unsupported = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'variant_count')) {
        return 'variant_count is required.';
    }

    if (!Number.isInteger(body.variant_count) || body.variant_count < 1) {
        return 'variant_count must be an integer greater than or equal to 1.';
    }

    if (body.variant_count > 100) {
        return 'variant_count cannot exceed 100 per generation batch.';
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'variant_code_start')) {
        return 'variant_code_start is required.';
    }

    const trimmedCode = typeof body.variant_code_start === 'string' ? body.variant_code_start.trim() : '';
    if (!/^\d{3,10}$/.test(trimmedCode)) {
        return 'variant_code_start must be a numeric string between 3 and 10 digits (e.g., "101").';
    }

    try {
        const startBig = BigInt(trimmedCode);
        const countBig = BigInt(body.variant_count);
        const lastCode = startBig + countBig - 1n;
        if (lastCode > 9999999999n) {
            return 'The generated variant codes would exceed the maximum length of 10 digits.';
        }
    } catch {
        return 'Invalid numeric format for variant_code_start.';
    }

    return null;
}

module.exports = {
    UUID_REGEX,
    VALID_EXAM_STATUSES,
    VALID_DELIVERY_MODES,
    VALID_VISIBILITY_MODES,
    VALID_DIFFICULTY_LEVELS,
    VALID_SCORING_MODES,
    VALID_ROUNDING_RULES,
    validateCreateExamBody,
    validatePatchExamBody,
    validateMatrixReplaceBody,
    validateGradingRulesReplaceBody,
    validateGenerateExamBody
};
