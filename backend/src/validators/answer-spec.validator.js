const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CANONICAL_KINDS = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'DROPDOWN', 'INPUT', 'MATCHING'];

/**
 * Validates an answer_spec object against canonical v1 rules
 * @param {object} answerSpec - The answer_spec to validate
 * @param {string} [expectedKind] - Expected question type code
 * @param {string} [questionContent] - Question text content (needed for DROPDOWN placeholder check)
 * @returns {string|null} - Error message string if invalid, or null if valid
 */
function validateAnswerSpec(answerSpec, expectedKind = null, questionContent = null) {
    if (!answerSpec || typeof answerSpec !== 'object' || Array.isArray(answerSpec)) {
        return 'answer_spec must be a JSON object.';
    }

    if (answerSpec.schema_version !== 1) {
        return 'answer_spec.schema_version must be integer 1.';
    }

    if (typeof answerSpec.kind !== 'string' || !CANONICAL_KINDS.includes(answerSpec.kind)) {
        return `answer_spec.kind must be one of: ${CANONICAL_KINDS.join(', ')}.`;
    }

    if (expectedKind && answerSpec.kind !== expectedKind) {
        return `answer_spec.kind ('${answerSpec.kind}') does not match question_type code ('${expectedKind}').`;
    }

    switch (answerSpec.kind) {
        case 'SINGLE_CHOICE':
            return validateSingleChoice(answerSpec);
        case 'MULTI_CHOICE':
            return validateMultiChoice(answerSpec);
        case 'DROPDOWN':
            return validateDropdown(answerSpec, questionContent);
        case 'INPUT':
            return validateInput(answerSpec);
        case 'MATCHING':
            return validateMatching(answerSpec);
        default:
            return 'Unsupported answer_spec kind.';
    }
}

function validateSingleChoice(spec) {
    const allowedKeys = ['schema_version', 'kind', 'choices'];
    if (Object.keys(spec).some(k => !allowedKeys.includes(k))) {
        return 'SINGLE_CHOICE answer_spec contains unsupported fields.';
    }

    if (!Array.isArray(spec.choices) || spec.choices.length < 2) {
        return 'SINGLE_CHOICE must have at least 2 choices.';
    }

    const seenIds = new Set();
    let correctCount = 0;

    for (let i = 0; i < spec.choices.length; i++) {
        const c = spec.choices[i];
        if (!c || typeof c !== 'object' || Array.isArray(c)) {
            return `Choice at index ${i} must be a JSON object.`;
        }

        const choiceKeys = ['id', 'text', 'order_no', 'is_correct'];
        if (Object.keys(c).some(k => !choiceKeys.includes(k))) {
            return `Choice at index ${i} contains unsupported fields.`;
        }

        if (typeof c.id !== 'string' || !UUID_REGEX.test(c.id)) {
            return `Choice at index ${i} must have a valid UUID id.`;
        }
        if (seenIds.has(c.id)) {
            return `Duplicate choice id '${c.id}' found.`;
        }
        seenIds.add(c.id);

        if (typeof c.text !== 'string' || !c.text.trim()) {
            return `Choice at index ${i} must have non-empty text.`;
        }

        if (!Number.isInteger(c.order_no) || c.order_no < 1) {
            return `Choice at index ${i} order_no must be an integer >= 1.`;
        }

        if (typeof c.is_correct !== 'boolean') {
            return `Choice at index ${i} is_correct must be a boolean.`;
        }

        if (c.is_correct) {
            correctCount++;
        }
    }

    if (correctCount !== 1) {
        return 'SINGLE_CHOICE must have exactly 1 correct choice.';
    }

    return null;
}

function validateMultiChoice(spec) {
    const allowedKeys = ['schema_version', 'kind', 'choices'];
    if (Object.keys(spec).some(k => !allowedKeys.includes(k))) {
        return 'MULTI_CHOICE answer_spec contains unsupported fields.';
    }

    if (!Array.isArray(spec.choices) || spec.choices.length < 2) {
        return 'MULTI_CHOICE must have at least 2 choices.';
    }

    const seenIds = new Set();
    let correctCount = 0;

    for (let i = 0; i < spec.choices.length; i++) {
        const c = spec.choices[i];
        if (!c || typeof c !== 'object' || Array.isArray(c)) {
            return `Choice at index ${i} must be a JSON object.`;
        }

        const choiceKeys = ['id', 'text', 'order_no', 'is_correct'];
        if (Object.keys(c).some(k => !choiceKeys.includes(k))) {
            return `Choice at index ${i} contains unsupported fields.`;
        }

        if (typeof c.id !== 'string' || !UUID_REGEX.test(c.id)) {
            return `Choice at index ${i} must have a valid UUID id.`;
        }
        if (seenIds.has(c.id)) {
            return `Duplicate choice id '${c.id}' found.`;
        }
        seenIds.add(c.id);

        if (typeof c.text !== 'string' || !c.text.trim()) {
            return `Choice at index ${i} must have non-empty text.`;
        }

        if (!Number.isInteger(c.order_no) || c.order_no < 1) {
            return `Choice at index ${i} order_no must be an integer >= 1.`;
        }

        if (typeof c.is_correct !== 'boolean') {
            return `Choice at index ${i} is_correct must be a boolean.`;
        }

        if (c.is_correct) {
            correctCount++;
        }
    }

    if (correctCount < 1) {
        return 'MULTI_CHOICE must have at least 1 correct choice.';
    }

    return null;
}

function validateDropdown(spec, questionContent) {
    const allowedKeys = ['schema_version', 'kind', 'blanks'];
    if (Object.keys(spec).some(k => !allowedKeys.includes(k))) {
        return 'DROPDOWN answer_spec contains unsupported fields.';
    }

    if (!Array.isArray(spec.blanks) || spec.blanks.length < 1) {
        return 'DROPDOWN must have at least 1 blank.';
    }

    const blankIds = new Set();

    for (let i = 0; i < spec.blanks.length; i++) {
        const b = spec.blanks[i];
        if (!b || typeof b !== 'object' || Array.isArray(b)) {
            return `Blank at index ${i} must be a JSON object.`;
        }

        const blankKeys = ['blank_id', 'choices', 'correct_value_id'];
        if (Object.keys(b).some(k => !blankKeys.includes(k))) {
            return `Blank at index ${i} contains unsupported fields.`;
        }

        if (typeof b.blank_id !== 'string' || !b.blank_id.trim()) {
            return `Blank at index ${i} must have a non-empty blank_id.`;
        }
        if (blankIds.has(b.blank_id)) {
            return `Duplicate blank_id '${b.blank_id}' found.`;
        }
        blankIds.add(b.blank_id);

        if (!Array.isArray(b.choices) || b.choices.length < 2) {
            return `Blank '${b.blank_id}' must have at least 2 choices.`;
        }

        const choiceValueIds = new Set();
        for (let j = 0; j < b.choices.length; j++) {
            const ch = b.choices[j];
            if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
                return `Choice at index ${j} in blank '${b.blank_id}' must be an object.`;
            }

            const chKeys = ['value_id', 'label'];
            if (Object.keys(ch).some(k => !chKeys.includes(k))) {
                return `Choice at index ${j} in blank '${b.blank_id}' contains unsupported fields.`;
            }

            if (typeof ch.value_id !== 'string' || !ch.value_id.trim()) {
                return `Choice at index ${j} in blank '${b.blank_id}' must have a non-empty value_id.`;
            }
            if (choiceValueIds.has(ch.value_id)) {
                return `Duplicate value_id '${ch.value_id}' in blank '${b.blank_id}'.`;
            }
            choiceValueIds.add(ch.value_id);

            if (typeof ch.label !== 'string' || !ch.label.trim()) {
                return `Choice at index ${j} in blank '${b.blank_id}' must have a non-empty label.`;
            }
        }

        if (typeof b.correct_value_id !== 'string' || !choiceValueIds.has(b.correct_value_id)) {
            return `Blank '${b.blank_id}' correct_value_id must match one of its choices value_id.`;
        }
    }

    if (typeof questionContent === 'string') {
        const placeholders = questionContent.match(/\{\{([^}]+)\}\}/g) || [];
        const foundPlaceholderIds = placeholders.map(p => p.slice(2, -2).trim());

        for (const blankId of blankIds) {
            const count = foundPlaceholderIds.filter(id => id === blankId).length;
            if (count !== 1) {
                return `Question content must contain exactly one placeholder '{{${blankId}}}' for blank '${blankId}'.`;
            }
        }

        for (const foundId of foundPlaceholderIds) {
            if (!blankIds.has(foundId)) {
                return `Question content contains unknown placeholder '{{${foundId}}}'.`;
            }
        }
    }

    return null;
}

function validateInput(spec) {
    const allowedKeys = ['schema_version', 'kind', 'equivalent_answers'];
    if (Object.keys(spec).some(k => !allowedKeys.includes(k))) {
        return 'INPUT answer_spec contains unsupported fields.';
    }

    if (!Array.isArray(spec.equivalent_answers) || spec.equivalent_answers.length < 1) {
        return 'INPUT must have at least 1 equivalent answer.';
    }

    const seenAnswers = new Set();
    for (let i = 0; i < spec.equivalent_answers.length; i++) {
        const ans = spec.equivalent_answers[i];
        if (typeof ans !== 'string' || !ans.trim()) {
            return `equivalent_answers at index ${i} must be a non-empty string.`;
        }
        if (seenAnswers.has(ans)) {
            return `Duplicate equivalent answer '${ans}' found.`;
        }
        seenAnswers.add(ans);
    }

    return null;
}

function validateMatching(spec) {
    const allowedKeys = ['schema_version', 'kind', 'left_items', 'right_items', 'pairs'];
    if (Object.keys(spec).some(k => !allowedKeys.includes(k))) {
        return 'MATCHING answer_spec contains unsupported fields.';
    }

    if (!Array.isArray(spec.left_items) || spec.left_items.length < 1) {
        return 'MATCHING must have at least 1 left_item.';
    }
    if (!Array.isArray(spec.right_items) || spec.right_items.length < 1) {
        return 'MATCHING must have at least 1 right_item.';
    }
    if (!Array.isArray(spec.pairs) || spec.pairs.length < 1) {
        return 'MATCHING must have at least 1 pair.';
    }

    const leftIds = new Set();
    for (let i = 0; i < spec.left_items.length; i++) {
        const item = spec.left_items[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return `left_item at index ${i} must be an object.`;
        }
        if (typeof item.id !== 'string' || !item.id.trim()) {
            return `left_item at index ${i} must have a non-empty id.`;
        }
        if (leftIds.has(item.id)) {
            return `Duplicate left_item id '${item.id}' found.`;
        }
        leftIds.add(item.id);
        if (typeof item.label !== 'string' || !item.label.trim()) {
            return `left_item at index ${i} must have a non-empty label.`;
        }
    }

    const rightIds = new Set();
    for (let i = 0; i < spec.right_items.length; i++) {
        const item = spec.right_items[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return `right_item at index ${i} must be an object.`;
        }
        if (typeof item.id !== 'string' || !item.id.trim()) {
            return `right_item at index ${i} must have a non-empty id.`;
        }
        if (rightIds.has(item.id)) {
            return `Duplicate right_item id '${item.id}' found.`;
        }
        rightIds.add(item.id);
        if (typeof item.label !== 'string' || !item.label.trim()) {
            return `right_item at index ${i} must have a non-empty label.`;
        }
    }

    const pairedLeftIds = new Set();
    const pairedRightIds = new Set();

    for (let i = 0; i < spec.pairs.length; i++) {
        const p = spec.pairs[i];
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
            return `Pair at index ${i} must be an object.`;
        }
        if (typeof p.left_id !== 'string' || !leftIds.has(p.left_id)) {
            return `Pair at index ${i} left_id must exist in left_items.`;
        }
        if (typeof p.right_id !== 'string' || !rightIds.has(p.right_id)) {
            return `Pair at index ${i} right_id must exist in right_items.`;
        }
        if (pairedLeftIds.has(p.left_id)) {
            return `left_id '${p.left_id}' is paired more than once.`;
        }
        if (pairedRightIds.has(p.right_id)) {
            return `right_id '${p.right_id}' is paired more than once.`;
        }
        pairedLeftIds.add(p.left_id);
        pairedRightIds.add(p.right_id);
    }

    return null;
}

module.exports = {
    validateAnswerSpec,
    CANONICAL_KINDS,
    UUID_REGEX
};

