/**
 * Convert zero-based option index into display label (A..Z, then O27...).
 */
function indexToDisplayLabel(idx) {
    if (idx < 26) return String.fromCharCode(65 + idx);
    return `O${idx + 1}`;
}

/**
 * Resolve choice objects ordered by a variant's optionOrder array.
 */
function getOrderedChoices(optionsSnapshot, optionOrder) {
    const choices = Array.isArray(optionsSnapshot?.choices) ? optionsSnapshot.choices : [];
    const byId = new Map(choices.map(c => [String(c.id), c]));
    const ordered = [];
    const seen = new Set();

    if (Array.isArray(optionOrder)) {
        for (const idOrIdx of optionOrder) {
            const key = String(idOrIdx);
            const found = byId.get(key) || (typeof idOrIdx === 'number' ? choices[idOrIdx] : null);
            if (found && !seen.has(found)) {
                ordered.push(found);
                seen.add(found);
            }
        }
    }

    for (const c of choices) {
        if (!seen.has(c)) {
            ordered.push(c);
            seen.add(c);
        }
    }

    return ordered;
}

function getOrderedMatchingPairs(optionsSnapshot, optionOrder) {
    const rightItems = Array.isArray(optionsSnapshot?.right_items) ? optionsSnapshot.right_items : [];
    const leftItems = Array.isArray(optionsSnapshot?.left_items) ? optionsSnapshot.left_items : [];
    const pairs = Array.isArray(optionsSnapshot?.pairs) ? optionsSnapshot.pairs : [];

    // optionOrder for MATCHING stores pair IDs or indexes if shuffled; shuffle right_items deterministically if needed
    if (!Array.isArray(optionOrder) || optionOrder.length === 0 || pairs.length === 0) {
        return {
            left_items: leftItems.map(item => ({id: item.id, label: item.label})),
            right_items: rightItems.map(item => ({id: item.id, label: item.label}))
        };
    }

    const pairRightById = new Map(pairs.map(p => [String(p.id), String(p.right_id)]));
    const rightById = new Map(rightItems.map(r => [String(r.id), r]));
    const orderedRights = [];
    const seen = new Set();

    for (const entry of optionOrder) {
        const rightId = pairRightById.get(String(entry)) || (typeof entry === 'number' ? pairs[entry]?.right_id : null);
        const item = rightId ? rightById.get(String(rightId)) : null;
        if (item && !seen.has(item)) {
            orderedRights.push({id: item.id, label: item.label});
            seen.add(item);
        }
    }
    for (const item of rightItems) {
        if (!seen.has(item)) {
            orderedRights.push({id: item.id, label: item.label});
            seen.add(item);
        }
    }

    return {
        left_items: leftItems.map(item => ({id: item.id, label: item.label})),
        right_items: orderedRights
    };
}

function getOrderedDropdownBlanks(optionsSnapshot, optionOrder) {
    const blanks = Array.isArray(optionsSnapshot?.blanks) ? optionsSnapshot.blanks : [];
    const orderByBlankId = new Map();

    if (Array.isArray(optionOrder)) {
        for (const entry of optionOrder) {
            if (entry && typeof entry === 'object' && entry.blank_id && Array.isArray(entry.choice_order)) {
                orderByBlankId.set(String(entry.blank_id), entry.choice_order.map(String));
            }
        }
    }

    return blanks.map(b => {
        const choices = Array.isArray(b.choices) ? b.choices : [];
        const desiredOrder = orderByBlankId.get(String(b.blank_id));
        if (!desiredOrder || desiredOrder.length === 0) {
            return {
                blank_id: b.blank_id,
                choices: choices.map(ch => ({value_id: ch.value_id, label: ch.label}))
            };
        }

        const byValueId = new Map(choices.map(ch => [String(ch.value_id), ch]));
        const ordered = [];
        const seen = new Set();

        for (const vid of desiredOrder) {
            const found = byValueId.get(vid);
            if (found && !seen.has(found)) {
                ordered.push({value_id: found.value_id, label: found.label});
                seen.add(found);
            }
        }
        for (const ch of choices) {
            if (!seen.has(ch)) {
                ordered.push({value_id: ch.value_id, label: ch.label});
                seen.add(ch);
            }
        }

        return {
            blank_id: b.blank_id,
            choices: ordered
        };
    });
}

/**
 * Strip secret answer keys and produce the safe student-facing render specification.
 */
function buildStudentRenderSpec(optionsSnapshot, optionOrder) {
    if (!optionsSnapshot || typeof optionsSnapshot !== 'object') {
        return null;
    }

    switch (optionsSnapshot.kind) {
        case 'SINGLE_CHOICE':
        case 'MULTI_CHOICE': {
            const orderedChoices = getOrderedChoices(optionsSnapshot, optionOrder);
            return {
                schema_version: 1,
                kind: optionsSnapshot.kind,
                choices: orderedChoices.map((c, idx) => ({
                    display_label: indexToDisplayLabel(idx),
                    text: c.text
                }))
            };
        }
        case 'DROPDOWN': {
            return {
                schema_version: 1,
                kind: 'DROPDOWN',
                blanks: getOrderedDropdownBlanks(optionsSnapshot, optionOrder)
            };
        }
        case 'INPUT': {
            return {
                schema_version: 1,
                kind: 'INPUT',
                input_hint: optionsSnapshot.input_hint ?? null
            };
        }
        case 'MATCHING': {
            const {left_items, right_items} = getOrderedMatchingPairs(optionsSnapshot, optionOrder);
            return {
                schema_version: 1,
                kind: 'MATCHING',
                left_items,
                right_items
            };
        }
        default:
            return null;
    }
}

module.exports = {
    indexToDisplayLabel,
    getOrderedChoices,
    buildStudentRenderSpec
};
