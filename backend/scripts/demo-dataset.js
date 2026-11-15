const {createHash} = require('node:crypto');
const {validateAnswerSpec} = require('../src/validators/answer-spec.validator');

/**
 * Derive a deterministic RFC-4122 version-4-compatible UUID from a stable seed key.
 */
function deterministicUuid(key) {
    const hash = createHash('sha256').update(`olms-demo:${key}`).digest();
    const bytes = Buffer.from(hash.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function makeChoices(qKey, items) {
    return items.map((item, idx) => ({
        id: deterministicUuid(`${qKey}:choice:${idx + 1}`),
        text: item[0],
        order_no: idx + 1,
        is_correct: Boolean(item[1])
    }));
}

function makeDropdown(blanks) {
    return {
        schema_version: 1,
        kind: 'DROPDOWN',
        blanks: blanks.map(([blankId, choices, correctValueId]) => ({
            blank_id: blankId,
            choices: choices.map(([valueId, label]) => ({value_id: valueId, label})),
            correct_value_id: correctValueId
        }))
    };
}

function makeMatching(lefts, rights, pairs) {
    return {
        schema_version: 1,
        kind: 'MATCHING',
        left_items: lefts.map(([id, label]) => ({id, label})),
        right_items: rights.map(([id, label]) => ({id, label})),
        pairs: pairs.map(([leftId, rightId]) => ({left_id: leftId, right_id: rightId}))
    };
}

function buildQuestion({lessonCode, typeCode, difficulty, topic, content, explanation, spec}) {
    const key = `${lessonCode}:${typeCode}`;
    const answerSpec = typeof spec === 'function' ? spec(key) : spec;
    const err = validateAnswerSpec(answerSpec, typeCode, content);
    if (err) {
        throw new Error(`Invalid demo question (${key}): ${err}`);
    }
    return {
        key,
        lesson_code: lessonCode,
        type_code: typeCode,
        difficulty_level: difficulty,
        topic_tag: topic,
        content,
        media_url: null,
        explanation,
        answer_spec: answerSpec
    };
}

const DEMO_USERS = [
    {
        key: 'teacher_1',
        username: 'demo_gv_csdl',
        full_name: 'Nguyễn Minh Quân',
        email: 'minhquan.demo@olms.invalid',
        role: 'TEACHER'
    },
    {
        key: 'teacher_2',
        username: 'demo_gv_mmt',
        full_name: 'Trần Thu Hà',
        email: 'thuha.demo@olms.invalid',
        role: 'TEACHER'
    }
];

const DEMO_SUBJECTS = [
    {
        code: 'CSDL',
        name: 'Cơ sở dữ liệu',
        description: 'Mô hình dữ liệu quan hệ, ràng buộc toàn vẹn và ngôn ngữ truy vấn SQL.',
        owner_key: 'teacher_1',
        chapters: [
            {
                code: 'CSDL_C1',
                name: 'Mô hình quan hệ',
                order_no: 1,
                lessons: [
                    {code: 'CSDL_C1_B1', name: 'Bảng và khóa', order_no: 1},
                    {code: 'CSDL_C1_B2', name: 'Ràng buộc toàn vẹn', order_no: 2}
                ]
            },
            {
                code: 'CSDL_C2',
                name: 'SQL cơ bản',
                order_no: 2,
                lessons: [
                    {code: 'CSDL_C2_B1', name: 'Truy vấn và lọc dữ liệu', order_no: 1},
                    {code: 'CSDL_C2_B2', name: 'JOIN và tổng hợp', order_no: 2}
                ]
            }
        ]
    },
    {
        code: 'CTDL',
        name: 'Cấu trúc dữ liệu và giải thuật',
        description: 'Các cấu trúc dữ liệu tuyến tính, tìm kiếm, sắp xếp và phân tích độ phức tạp.',
        owner_key: 'teacher_1',
        chapters: [
            {
                code: 'CTDL_C1',
                name: 'Cấu trúc tuyến tính',
                order_no: 1,
                lessons: [
                    {code: 'CTDL_C1_B1', name: 'Mảng và danh sách liên kết', order_no: 1},
                    {code: 'CTDL_C1_B2', name: 'Ngăn xếp và hàng đợi', order_no: 2}
                ]
            },
            {
                code: 'CTDL_C2',
                name: 'Tìm kiếm và sắp xếp',
                order_no: 2,
                lessons: [
                    {code: 'CTDL_C2_B1', name: 'Tìm kiếm tuyến tính và nhị phân', order_no: 1},
                    {code: 'CTDL_C2_B2', name: 'Các thuật toán sắp xếp cơ bản', order_no: 2}
                ]
            }
        ]
    },
    {
        code: 'MMT',
        name: 'Mạng máy tính',
        description: 'Kiến trúc phân tầng TCP/IP, đánh địa chỉ IPv4/subnet và giao thức tầng ứng dụng.',
        owner_key: 'teacher_2',
        chapters: [
            {
                code: 'MMT_C1',
                name: 'Kiến thức nền tảng',
                order_no: 1,
                lessons: [
                    {code: 'MMT_C1_B1', name: 'Mô hình TCP/IP', order_no: 1},
                    {code: 'MMT_C1_B2', name: 'Địa chỉ IPv4 và subnet', order_no: 2}
                ]
            },
            {
                code: 'MMT_C2',
                name: 'Giao thức ứng dụng',
                order_no: 2,
                lessons: [
                    {code: 'MMT_C2_B1', name: 'Hệ thống tên miền DNS', order_no: 1},
                    {code: 'MMT_C2_B2', name: 'Giao thức HTTP và HTTPS', order_no: 2}
                ]
            }
        ]
    }
];

const RAW_QUESTIONS = [
    // ======================== CSDL_C1_B1: Bảng và khóa ========================
    {
        lessonCode: 'CSDL_C1_B1',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Khái niệm khóa chính',
        content: 'Trong mô hình dữ liệu quan hệ, thuộc tính nào đảm bảo phân biệt duy nhất từng bộ (hàng) trong một bảng và không được mang giá trị NULL?',
        explanation: 'Khóa chính (PRIMARY KEY) vừa đảm bảo tính duy nhất (UNIQUE) vừa bắt buộc khác NULL (NOT NULL).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['Khóa chính (PRIMARY KEY)', true],
                ['Khóa ngoại (FOREIGN KEY)', false],
                ['Thuộc tính đa trị', false],
                ['Chỉ mục không duy nhất (Non-unique Index)', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C1_B1',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Tính chất khóa ứng viên',
        content: 'Những phát biểu nào sau đây đúng về khóa ứng viên (Candidate Key) của một quan hệ R?',
        explanation: 'Mọi khóa ứng viên đều là siêu khóa tối tiểu (không chứa tập con thực sự nào cũng là siêu khóa) và một bảng có thể có nhiều hơn một khóa ứng viên.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['Xác định duy nhất mỗi bộ trong quan hệ R', true],
                ['Không thể bỏ bớt bất kỳ thuộc tính nào mà vẫn giữ tính duy nhất', true],
                ['Một bảng chỉ có tối đa duy nhất một khóa ứng viên', false],
                ['Khóa ứng viên bắt buộc phải trùng tên với cột ở bảng cha', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C1_B1',
        typeCode: 'DROPDOWN',
        difficulty: 'EASY',
        topic: 'Cấu trúc quan hệ',
        content: 'Trong lược đồ quan hệ chuẩn, một {{b1}} tương ứng với một cột dữ liệu, còn bậc (degree) của quan hệ được xác định bởi {{b2}}.',
        explanation: 'Mỗi cột biểu diễn một thuộc tính (attribute) và bậc của quan hệ là tổng số thuộc tính của quan hệ đó.',
        spec: makeDropdown([
            ['b1', [['v1', 'thuộc tính (attribute)'], ['v2', 'bộ dữ liệu (tuple)'], ['v3', 'ràng buộc miền']], 'v1'],
            ['b2', [['v1', 'số lượng thuộc tính của quan hệ'], ['v2', 'số lượng dòng đang lưu'], ['v3', 'kích thước bộ nhớ của khóa ngoại']], 'v1']
        ])
    },
    {
        lessonCode: 'CSDL_C1_B1',
        typeCode: 'INPUT',
        difficulty: 'MEDIUM',
        topic: 'Đếm số siêu khóa',
        content: 'Cho quan hệ R(A, B, C, D) có duy nhất một khóa ứng viên là A. Hỏi quan hệ R có bao nhiêu siêu khóa (superkey)? Nhập một số nguyên.',
        explanation: 'Mọi tập con của {B, C, D} hợp với A đều là siêu khóa, suy ra số siêu khóa là 2^3 = 8.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['8', 'tám']
        }
    },
    {
        lessonCode: 'CSDL_C1_B1',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Phân loại khóa',
        content: 'Ghép mỗi loại khóa trong CSDL quan hệ với vai trò phù hợp.',
        explanation: 'Superkey xác định duy nhất bộ; Primary Key là khóa ứng viên được chọn đại diện chính thức; Foreign Key tham chiếu sang khóa duy nhất của bảng khác.',
        spec: makeMatching(
            [['l1', 'Superkey'], ['l2', 'Primary Key'], ['l3', 'Foreign Key']],
            [['r1', 'Tập thuộc tính bất kỳ xác định duy nhất một bộ'], ['r2', 'Khóa ứng viên được chọn làm định danh chính và không NULL'], ['r3', 'Thuộc tính tham chiếu đến khóa chính/ứng viên của bảng khác']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CSDL_C1_B2: Ràng buộc toàn vẹn ========================
    {
        lessonCode: 'CSDL_C1_B2',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Toàn vẹn tham chiếu',
        content: 'Ràng buộc toàn vẹn tham chiếu (Referential Integrity) nhằm đảm bảo điều gì giữa bảng con Orders(id, customer_id) và bảng cha Customers(id)?',
        explanation: 'Mỗi giá trị customer_id khác NULL ở bảng con Orders phải tồn tại trong tập giá trị id của bảng cha Customers.',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['Mỗi giá trị customer_id khác NULL trong Orders phải khớp với một giá trị id tồn tại trong Customers', true],
                ['Số dòng trong Orders luôn phải bằng số dòng trong Customers', false],
                ['Cột customer_id tự động tăng theo thứ tự bảng chữ cái', false],
                ['Mỗi khách hàng chỉ được phép có đúng một đơn hàng', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C1_B2',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'HARD',
        topic: 'Hành động ON DELETE',
        content: 'Khi định nghĩa FOREIGN KEY với bảng cha trong SQL chuẩn, những hành động hợp lệ nào thường được dùng cho mệnh đề ON DELETE khi xóa bản ghi cha?',
        explanation: 'SQL hỗ trợ CASCADE, SET NULL, SET DEFAULT và RESTRICT / NO ACTION khi bản ghi cha bị xóa.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['ON DELETE CASCADE (xóa theo dây chuyền các bản ghi con tham chiếu)', true],
                ['ON DELETE SET NULL (đặt cột khóa ngoại ở bảng con về NULL nếu cột cho phép NULL)', true],
                ['ON DELETE RESTRICT (từ chối xóa bản ghi cha nếu vẫn còn bản ghi con tham chiếu)', true],
                ['ON DELETE SORT BY (tự động sắp xếp lại khóa chính bảng cha)', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C1_B2',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Ràng buộc CHECK và NOT NULL',
        content: 'Để đảm bảo cột điểm score nằm trong đoạn [0, 10], ta dùng ràng buộc {{b1}}; còn để cấm bỏ trống giá trị ở cột họ tên, ta dùng ràng buộc {{b2}}.',
        explanation: 'Ràng buộc CHECK (score >= 0 AND score <= 10) kiểm tra điều kiện logic miền giá trị, còn NOT NULL cấm giá trị NULL.',
        spec: makeDropdown([
            ['b1', [['v1', 'CHECK'], ['v2', 'FOREIGN KEY'], ['v3', 'AUTO_INCREMENT']], 'v1'],
            ['b2', [['v1', 'NOT NULL'], ['v2', 'GROUP BY'], ['v3', 'DEFAULT NULL']], 'v1']
        ])
    },
    {
        lessonCode: 'CSDL_C1_B2',
        typeCode: 'INPUT',
        difficulty: 'EASY',
        topic: 'Từ khóa ràng buộc duy nhất',
        content: 'Trong SQL DDL, từ khóa ràng buộc nào bảo đảm mọi giá trị khác NULL trong một cột email không bị trùng lặp nhau?',
        explanation: 'Ràng buộc UNIQUE đảm bảo không có hai dòng nào có cùng giá trị email khác NULL.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['UNIQUE']
        }
    },
    {
        lessonCode: 'CSDL_C1_B2',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Nhóm ràng buộc toàn vẹn',
        content: 'Ghép mỗi loại ràng buộc với ví dụ minh họa tương ứng trên bảng Enrollments(student_id, exam_id, score).',
        explanation: 'Toàn vẹn miền giới hạn score 0..10; toàn vẹn thực thể cấm khóa chính NULL; toàn vẹn tham chiếu ràng buộc student_id tồn tại ở Students.',
        spec: makeMatching(
            [['l1', 'Toàn vẹn thực thể (Entity Integrity)'], ['l2', 'Toàn vẹn miền (Domain Integrity)'], ['l3', 'Toàn vẹn tham chiếu (Referential Integrity)']],
            [['r1', 'Khóa chính (student_id, exam_id) không chứa thành phần NULL'], ['r2', 'CHECK (score BETWEEN 0 AND 10)'], ['r3', 'student_id tham chiếu đến bảng Students(id)']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CSDL_C2_B1: Truy vấn và lọc dữ liệu ========================
    {
        lessonCode: 'CSDL_C2_B1',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Lọc kết quả trước và sau gom nhóm',
        content: 'Cho bảng Students(id, full_name, status, gpa). Mệnh đề SQL nào dùng để lọc từng dòng có status = \'ACTIVE\' trước khi sắp xếp bằng ORDER BY?',
        explanation: 'Mệnh đề WHERE lọc các dòng dữ liệu đầu vào thỏa mãn điều kiện.',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['WHERE', true],
                ['GROUP BY', false],
                ['HAVING', false],
                ['DISTINCT', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C2_B1',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Toán tử NULL và mẫu chuỗi',
        content: 'Trong SQL chuẩn trên bảng Users(id, email, full_name), những biểu thức điều kiện nào hợp lệ để kiểm tra email chưa có giá trị hoặc tìm tên bắt đầu bằng "Nguyễn"?',
        explanation: 'Kiểm tra NULL phải dùng IS NULL (không dùng = NULL), và mẫu bắt đầu bằng chuỗi dùng LIKE \'Nguyễn%\'.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['email IS NULL', true],
                ["full_name LIKE 'Nguyễn%'", true],
                ['email = NULL', false],
                ["full_name IN ('Nguyễn%')", false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C2_B1',
        typeCode: 'DROPDOWN',
        difficulty: 'EASY',
        topic: 'Loại bỏ trùng lặp và phân trang',
        content: 'Để loại bỏ các giá trị trùng lặp trong tập kết quả SELECT ta thêm từ khóa {{b1}}; để lấy tối đa 20 dòng đầu sau khi sắp xếp ta dùng mệnh đề {{b2}}.',
        explanation: 'SELECT DISTINCT loại bỏ bản ghi trùng nhau và LIMIT giới hạn số dòng trả về.',
        spec: makeDropdown([
            ['b1', [['v1', 'DISTINCT'], ['v2', 'UNIQUE'], ['v3', 'FILTER']], 'v1'],
            ['b2', [['v1', 'LIMIT 20'], ['v2', 'TOP OF 20'], ['v3', 'RANGE 20']], 'v1']
        ])
    },
    {
        lessonCode: 'CSDL_C2_B1',
        typeCode: 'INPUT',
        difficulty: 'MEDIUM',
        topic: 'Thứ tự thực thi câu truy vấn',
        content: 'Trong truy vấn "SELECT department, COUNT(*) FROM Employees WHERE salary > 1000 GROUP BY department HAVING COUNT(*) >= 3 ORDER BY department;", từ khóa mệnh đề nào bắt buộc đứng trước ORDER BY để lọc các nhóm có từ 3 nhân viên trở lên?',
        explanation: 'Mệnh đề HAVING lọc trên kết quả đã được gom nhóm bởi GROUP BY.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['HAVING']
        }
    },
    {
        lessonCode: 'CSDL_C2_B1',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Ký tự đại diện LIKE',
        content: 'Ghép mẫu LIKE trong SQL với ý nghĩa khớp chuỗi tương ứng.',
        explanation: '% khớp 0 hoặc nhiều ký tự bất kỳ; _ khớp đúng 1 ký tự; ILIKE (PostgreSQL) hoặc LOWER+LIKE so khớp không phân biệt hoa thường.',
        spec: makeMatching(
            [['l1', "LIKE 'CS%'"], ['l2', "LIKE 'CS__'"], ['l3', "IS NOT NULL"]],
            [['r1', 'Chuỗi bắt đầu bằng CS và dài từ 2 ký tự trở lên'], ['r2', 'Chuỗi bắt đầu bằng CS và có đúng 4 ký tự'], ['r3', 'Cột có chứa giá trị xác định (khác NULL)']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CSDL_C2_B2: JOIN và tổng hợp ========================
    {
        lessonCode: 'CSDL_C2_B2',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Hành vi LEFT JOIN',
        content: 'Cho bảng Subjects(id, code) có 3 môn học và bảng Exams(id, subject_id) chỉ mới có đề ở 2 môn. Câu lệnh "SELECT s.code, e.id FROM Subjects s LEFT JOIN Exams e ON e.subject_id = s.id" trả về cột e.id mang giá trị gì cho môn chưa có đề thi?',
        explanation: 'LEFT JOIN giữ nguyên mọi dòng từ bảng bên trái (Subjects) và điền NULL vào các cột của bảng bên phải nếu không tìm thấy dòng khớp.',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['NULL', true],
                ['0', false],
                ['Chuỗi rỗng ""', false],
                ['Môn chưa có đề sẽ bị loại khỏi kết quả', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C2_B2',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Hàm tổng hợp SQL',
        content: 'Cho bảng Grades(student_id, score). Trong đó một sinh viên có score là NULL. Những nhận xét nào đúng về các hàm tổng hợp trên cột score?',
        explanation: 'AVG(score) và SUM(score) bỏ qua giá trị NULL khi tính; COUNT(*) đếm mọi dòng kể cả NULL còn COUNT(score) chỉ đếm dòng khác NULL.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['COUNT(score) chỉ đếm những dòng mà score khác NULL', true],
                ['COUNT(*) đếm toàn bộ số dòng của bảng bao gồm cả dòng có score = NULL', true],
                ['AVG(score) coi mỗi giá trị NULL bằng 0 rồi chia cho tổng số dòng', false],
                ['MAX(score) luôn trả về NULL nếu bảng có ít nhất một dòng chứa NULL', false]
            ])
        })
    },
    {
        lessonCode: 'CSDL_C2_B2',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'INNER JOIN vs CROSS JOIN',
        content: 'Khi chỉ muốn lấy các cặp bản ghi khớp điều kiện ghép giữa hai bảng ta dùng {{b1}}; còn nếu cần ghép mọi dòng bảng thứ nhất với mọi dòng bảng thứ hai (tích Descartes) ta dùng {{b2}}.',
        explanation: 'INNER JOIN lọc theo điều kiện ON; CROSS JOIN tạo tích Descartes có m × n dòng.',
        spec: makeDropdown([
            ['b1', [['v1', 'INNER JOIN'], ['v2', 'CROSS JOIN'], ['v3', 'EXCEPT']], 'v1'],
            ['b2', [['v1', 'CROSS JOIN'], ['v2', 'NATURAL INTERSECT'], ['v3', 'INNER JOIN']], 'v1']
        ])
    },
    {
        lessonCode: 'CSDL_C2_B2',
        typeCode: 'INPUT',
        difficulty: 'HARD',
        topic: 'Số dòng CROSS JOIN',
        content: 'Bảng Chapters có 6 dòng và bảng QuestionTypes có 5 dòng. Truy vấn "SELECT * FROM Chapters CROSS JOIN QuestionTypes;" trả về tất cả bao nhiêu dòng?',
        explanation: 'CROSS JOIN trả về tích Descartes có 6 × 5 = 30 dòng.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['30']
        }
    },
    {
        lessonCode: 'CSDL_C2_B2',
        typeCode: 'MATCHING',
        difficulty: 'EASY',
        topic: 'Các phép nối và tổng hợp',
        content: 'Ghép mỗi hàm hoặc phép nối SQL với công dụng tương ứng.',
        explanation: 'INNER JOIN trả về phần giao khớp điều kiện; LEFT JOIN giữ toàn bộ bảng trái; COALESCE trả về giá trị khác NULL đầu tiên.',
        spec: makeMatching(
            [['l1', 'INNER JOIN'], ['l2', 'LEFT JOIN'], ['l3', 'COALESCE(a, 0)']],
            [['r1', 'Chỉ giữ các cặp dòng thỏa mãn điều kiện ON'], ['r2', 'Giữ mọi dòng bảng trái, bảng phải điền NULL nếu không khớp'], ['r3', 'Thay thế giá trị NULL của biểu thức a bằng 0']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CTDL_C1_B1: Mảng và danh sách liên kết ========================
    {
        lessonCode: 'CTDL_C1_B1',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Truy cập ngẫu nhiên trên mảng',
        content: 'Trong một mảng một chiều kích thước n cấp phát liên tiếp trong bộ nhớ, độ phức tạp thời gian để truy cập trực tiếp phần tử tại chỉ số i (arr[i]) là bao nhiêu?',
        explanation: 'Địa chỉ phần tử thứ i được tính trực tiếp bằng base_address + i * element_size nên mất thời gian hằng số O(1).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['O(1)', true],
                ['O(log n)', false],
                ['O(n)', false],
                ['O(n log n)', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C1_B1',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'So sánh mảng và danh sách liên kết đơn',
        content: 'So sánh giữa mảng tĩnh kích thước cố định và danh sách liên kết đơn (Singly Linked List chỉ lưu con trỏ head), những phát biểu nào đúng?',
        explanation: 'Chèn vào đầu danh sách liên kết đơn chỉ cần O(1); ngược lại truy cập phần tử thứ k ở danh sách liên kết mất O(n) và tốn bộ nhớ lưu con trỏ next.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['Chèn một nút vào đầu danh sách liên kết đơn mất thời gian O(1)', true],
                ['Truy cập phần tử theo chỉ số k trong danh sách liên kết đơn cần duyệt từ đầu mất O(n)', true],
                ['Danh sách liên kết đơn tận dụng cache CPU tốt hơn mảng liên tiếp', false],
                ['Mảng tĩnh không thể lưu quá 100 phần tử trong mọi ngôn ngữ lập trình', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C1_B1',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Chèn giữa mảng vs liên kết kép',
        content: 'Khi chèn phần tử vào vị trí đầu tiên của mảng tĩnh đang có n phần tử (còn chỗ trống), ta phải dịch phải n phần tử nên tốn {{b1}}; còn trong danh sách liên kết đơn đã biết con trỏ đứng ngay trước vị trí chèn, thao tác chèn nút mới mất {{b2}}.',
        explanation: 'Dịch chuyển n phần tử trên mảng tốn O(n); cập nhật 2 con trỏ next trên danh sách liên kết mất O(1).',
        spec: makeDropdown([
            ['b1', [['v1', 'O(n)'], ['v2', 'O(1)'], ['v3', 'O(n^2)']], 'v1'],
            ['b2', [['v1', 'O(1)'], ['v2', 'O(n log n)'], ['v3', 'O(n)']], 'v1']
        ])
    },
    {
        lessonCode: 'CTDL_C1_B1',
        typeCode: 'INPUT',
        difficulty: 'MEDIUM',
        topic: 'Tính địa chỉ phần tử mảng',
        content: 'Một mảng số nguyên 32-bit (mỗi phần tử chiếm 4 byte) được lưu liên tiếp từ địa chỉ 1000. Địa chỉ bắt đầu của phần tử arr[5] (đánh chỉ số từ 0) là bao nhiêu?',
        explanation: 'Địa chỉ arr[5] = 1000 + 5 × 4 = 1020.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['1020']
        }
    },
    {
        lessonCode: 'CTDL_C1_B1',
        typeCode: 'MATCHING',
        difficulty: 'EASY',
        topic: 'Thành phần danh sách liên kết',
        content: 'Ghép mỗi khái niệm trong danh sách liên kết với đặc điểm đúng.',
        explanation: 'Singly Linked List mỗi nút chỉ trỏ tới next; Doubly Linked List có cả prev và next; Circular Linked List nút cuối trỏ về nút đầu.',
        spec: makeMatching(
            [['l1', 'Danh sách liên kết đơn'], ['l2', 'Danh sách liên kết kép'], ['l3', 'Danh sách liên kết vòng']],
            [['r1', 'Mỗi nút chỉ chứa dữ liệu và một con trỏ next'], ['r2', 'Mỗi nút chứa cả con trỏ prev và con trỏ next'], ['r3', 'Con trỏ next của nút cuối trỏ quay lại nút đầu']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CTDL_C1_B2: Ngăn xếp và hàng đợi ========================
    {
        lessonCode: 'CTDL_C1_B2',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Nguyên tắc LIFO của Stack',
        content: 'Ngăn xếp (Stack) hoạt động theo nguyên tắc nào và thao tác push/pop ở đỉnh có độ phức tạp thời gian chuẩn là bao nhiêu?',
        explanation: 'Stack tuân theo nguyên tắc Vào sau Ra trước (LIFO - Last In, First Out) với push/pop mất O(1).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['LIFO (Last In, First Out) và O(1)', true],
                ['FIFO (First In, First Out) và O(1)', false],
                ['LIFO (Last In, First Out) và O(n)', false],
                ['Truy cập ngẫu nhiên và O(log n)', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C1_B2',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Ứng dụng Stack và Queue',
        content: 'Những bài toán nào sau đây sử dụng trực tiếp cấu trúc ngăn xếp (Stack) hoặc hàng đợi (Queue) đúng với tính chất đặc trưng của nó?',
        explanation: 'Duyệt theo chiều rộng (BFS) dùng Queue; kiểm tra ngoặc cân bằng dùng Stack; Undo/Redo dùng Stack.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['Kiểm tra tính cân bằng của cặp dấu ngoặc trong biểu thức bằng Stack', true],
                ['Tìm đường đi ngắn nhất trên đồ thị không trọng số bằng thuật toán BFS dùng Queue', true],
                ['Cơ chế Undo (hoàn tác thao tác gần nhất) trong trình soạn thảo dùng Stack', true],
                ['Tìm phần tử trung vị động nhanh nhất chỉ bằng duy nhất một Queue thuần túy ở O(1)', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C1_B2',
        typeCode: 'DROPDOWN',
        difficulty: 'EASY',
        topic: 'FIFO và hàng đợi vòng',
        content: 'Hàng đợi (Queue) tuân theo quy tắc {{b1}}; để tránh lãng phí ô nhớ phía trước mảng khi dequeue nhiều lần, người ta thường cài đặt hàng đợi bằng {{b2}}.',
        explanation: 'Queue hoạt động theo FIFO; mảng vòng (Circular Array) cho phép xoay vòng chỉ số front/rear với modulo.',
        spec: makeDropdown([
            ['b1', [['v1', 'FIFO (vào trước ra trước)'], ['v2', 'LIFO (vào sau ra trước)'], ['v3', 'Ưu tiên khóa nhỏ nhất']], 'v1'],
            ['b2', [['v1', 'mảng vòng (Circular Array)'], ['v2', 'cây nhị phân tìm kiếm'], ['v3', 'bảng băm hai chiều']], 'v1']
        ])
    },
    {
        lessonCode: 'CTDL_C1_B2',
        typeCode: 'INPUT',
        difficulty: 'MEDIUM',
        topic: 'Tính toán trên Stack rỗng',
        content: 'Bắt đầu với một Stack rỗng, thực hiện tuần tự các thao tác: push(10), push(25), pop(), push(40), push(15), pop(). Phần tử nằm ở đỉnh Stack (top) sau bước cuối cùng có giá trị bằng bao nhiêu?',
        explanation: 'push(10)->[10], push(25)->[10,25], pop()->[10], push(40)->[10,40], push(15)->[10,40,15], pop()->[10,40]. Đỉnh Stack là 40.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['40']
        }
    },
    {
        lessonCode: 'CTDL_C1_B2',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Phép toán Stack và Queue',
        content: 'Ghép mỗi thao tác với ý nghĩa tương ứng trên Stack hoặc Queue.',
        explanation: 'push thêm vào đỉnh Stack; peek đọc đỉnh không xóa; enqueue thêm vào cuối Queue; dequeue lấy ra từ đầu Queue.',
        spec: makeMatching(
            [['l1', 'Stack push(x)'], ['l2', 'Stack peek()'], ['l3', 'Queue dequeue()']],
            [['r1', 'Đưa phần tử x vào đỉnh ngăn xếp'], ['r2', 'Xem phần tử ở đỉnh ngăn xếp mà không xóa'], ['r3', 'Lấy và xóa phần tử ở đầu hàng đợi']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CTDL_C2_B1: Tìm kiếm tuyến tính và nhị phân ========================
    {
        lessonCode: 'CTDL_C2_B1',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Điều kiện áp dụng Binary Search',
        content: 'Để áp dụng đúng thuật toán tìm kiếm nhị phân (Binary Search) trên một mảng, điều kiện tiên quyết nào sau đây phải được thỏa mãn?',
        explanation: 'Tìm kiếm nhị phân chia đôi khoảng tìm kiếm dựa trên tính đơn điệu, nên mảng bắt buộc phải được sắp xếp sẵn (tăng hoặc giảm).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['Mảng phải được sắp xếp theo một thứ tự xác định (tăng dần hoặc giảm dần)', true],
                ['Mọi phần tử trong mảng đều phải là số dương', false],
                ['Số phần tử n phải là một lũy thừa của 2', false],
                ['Mảng không được chứa số 0', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C2_B1',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Độ phức tạp tìm kiếm',
        content: 'Cho mảng đã sắp xếp tăng dần gồm n phần tử (n > 1). Những khẳng định nào sau đây đúng khi so sánh Linear Search và Binary Search?',
        explanation: 'Linear Search xấu nhất O(n), tốt nhất O(1) nếu khớp đầu mảng; Binary Search xấu nhất O(log n) nhưng đòi hỏi truy cập ngẫu nhiên nên không hiệu quả O(log n) trên danh sách liên kết đơn.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['Trong trường hợp xấu nhất, Binary Search có độ phức tạp O(log n)', true],
                ['Trong trường hợp tốt nhất (gặp phần tử ngay đầu mảng), Linear Search mất O(1)', true],
                ['Binary Search trên danh sách liên kết đơn vẫn đạt tổng thời gian O(log n)', false],
                ['Linear Search chỉ chạy được khi mảng đã sắp xếp', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C2_B1',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Tránh tràn số khi tính mid',
        content: 'Khi viết Binary Search trong khoảng chỉ số nguyên [low, high] trên ngôn ngữ có giới hạn số nguyên 32-bit, cách tính chỉ số giữa an toàn hơn để tránh tràn số là {{b1}}; sau mỗi bước không tìm thấy ở mid, kích thước không gian tìm kiếm giảm khoảng {{b2}}.',
        explanation: 'low + Math.floor((high - low) / 2) tránh tràn số khi low + high vượt MAX_INT; mỗi bước thu hẹp một nửa không gian tìm kiếm.',
        spec: makeDropdown([
            ['b1', [['v1', 'low + (high - low) / 2'], ['v2', '(low * high) / 2'], ['v3', 'high - low']], 'v1'],
            ['b2', [['v1', 'một nửa (1/2)'], ['v2', 'chỉ 1 phần tử'], ['v3', 'hai phần ba']], 'v1']
        ])
    },
    {
        lessonCode: 'CTDL_C2_B1',
        typeCode: 'INPUT',
        difficulty: 'HARD',
        topic: 'Số lần so sánh tối đa Binary Search',
        content: 'Cho mảng đã sắp xếp gồm 1024 phần tử phân biệt. Với Binary Search thông thường, trong trường hợp xấu nhất không tìm thấy khóa hoặc nằm ở bước cuối cùng, cần tối đa bao nhiêu lần chia đôi (lần kiểm tra mid) biết log2(1024) = 10?',
        explanation: 'Với n = 1024, sau tối đa floor(log2(1024)) + 1 = 11 lần kiểm tra (1024 -> 512 -> ... -> 1 -> rỗng), thuật toán chắc chắn kết luận.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['11']
        }
    },
    {
        lessonCode: 'CTDL_C2_B1',
        typeCode: 'MATCHING',
        difficulty: 'EASY',
        topic: 'Trường hợp độ phức tạp tìm kiếm',
        content: 'Ghép mỗi tình huống tìm kiếm phần tử x trong mảng kích thước n với độ phức tạp tương ứng.',
        explanation: 'Linear Search trung bình và xấu nhất là O(n); Binary Search xấu nhất là O(log n); cả hai đều O(1) ở tình huống lý tưởng ngay bước đầu tiên.',
        spec: makeMatching(
            [['l1', 'Linear Search - trường hợp xấu nhất'], ['l2', 'Binary Search - trường hợp xấu nhất'], ['l3', 'Binary Search - x nằm đúng tại mid lần đầu']],
            [['r1', 'O(n)'], ['r2', 'O(log n)'], ['r3', 'O(1)']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== CTDL_C2_B2: Các thuật toán sắp xếp cơ bản ========================
    {
        lessonCode: 'CTDL_C2_B2',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Số lần hoán đổi Selection Sort',
        content: 'Thuật toán sắp xếp chọn (Selection Sort) trên mảng n phần tử thực hiện tối đa bao nhiêu phép hoán đổi (swap) trong toàn bộ quá trình sắp xếp?',
        explanation: 'Mỗi vòng lặp ngoài i từ 0 đến n - 2 tìm phần tử nhỏ nhất và thực hiện tối đa 1 phép swap về vị trí i, nên tổng số swap là O(n).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['O(n) (tối đa n - 1 phép swap)', true],
                ['O(n^2) trong mọi lần chạy', false],
                ['O(log n)', false],
                ['O(n log n)', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C2_B2',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Tính ổn định và thích nghi của thuật toán sắp xếp',
        content: 'Những phát biểu nào đúng về các thuật toán sắp xếp Bubble Sort, Insertion Sort và Merge Sort?',
        explanation: 'Insertion Sort đạt O(n) trên mảng gần như đã sắp xếp; Merge Sort đảm bảo O(n log n) ở mọi trường hợp và ổn định (stable).',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['Insertion Sort đạt độ phức tạp O(n) nếu mảng đầu vào đã được sắp xếp sẵn', true],
                ['Merge Sort có độ phức tạp trường hợp xấu nhất là O(n log n) và bảo toàn thứ tự ổn định (stable)', true],
                ['QuickSort luôn có độ phức tạp O(n log n) ở trường hợp xấu nhất không cần chọn pivot ngẫu nhiên', false],
                ['Selection Sort đạt O(n) nếu mảng đầu vào đã sắp xếp sẵn', false]
            ])
        })
    },
    {
        lessonCode: 'CTDL_C2_B2',
        typeCode: 'DROPDOWN',
        difficulty: 'EASY',
        topic: 'Thuật toán sắp xếp ổn định',
        content: 'Một thuật toán sắp xếp được gọi là {{b1}} nếu nó giữ nguyên thứ tự tương đối ban đầu của các phần tử có khóa bằng nhau; trong nhóm sắp xếp chia để trị, {{b2}} luôn đảm bảo độ phức tạp xấu nhất O(n log n).',
        explanation: 'Stable sort giữ nguyên thứ tự gốc của các khóa bằng nhau; Merge Sort luôn đạt O(n log n) trong trường hợp xấu nhất.',
        spec: makeDropdown([
            ['b1', [['v1', 'ổn định (stable)'], ['v2', 'tại chỗ (in-place)'], ['v3', 'ngẫu nhiên']], 'v1'],
            ['b2', [['v1', 'Merge Sort'], ['v2', 'Bubble Sort'], ['v3', 'Insertion Sort']], 'v1']
        ])
    },
    {
        lessonCode: 'CTDL_C2_B2',
        typeCode: 'INPUT',
        difficulty: 'MEDIUM',
        topic: 'Số nghịch thế và hoán đổi Bubble Sort',
        content: 'Cho mảng [4, 3, 2, 1] gồm 4 phần tử giảm dần. Thuật toán Bubble Sort không bỏ sót bước phải thực hiện tất cả bao nhiêu phép hoán đổi hai phần tử kề nhau để đưa mảng về [1, 2, 3, 4]?',
        explanation: 'Số cặp nghịch thế của mảng [4, 3, 2, 1] là 4 × 3 / 2 = 6, tương ứng đúng 6 phép đổi chỗ kề nhau.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['6']
        }
    },
    {
        lessonCode: 'CTDL_C2_B2',
        typeCode: 'MATCHING',
        difficulty: 'HARD',
        topic: 'Đặc tính thuật toán sắp xếp',
        content: 'Ghép mỗi thuật toán sắp xếp với độ phức tạp đặc trưng tương ứng.',
        explanation: 'Selection Sort luôn mất O(n^2) phép so sánh; Insertion Sort mất O(n) trên mảng đã sắp; Merge Sort luôn O(n log n).',
        spec: makeMatching(
            [['l1', 'Insertion Sort (mảng đã sắp xếp)'], ['l2', 'Selection Sort (mọi trường hợp)'], ['l3', 'Merge Sort (mọi trường hợp)']],
            [['r1', 'O(n)'], ['r2', 'O(n^2)'], ['r3', 'O(n log n)']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== MMT_C1_B1: Mô hình TCP/IP ========================
    {
        lessonCode: 'MMT_C1_B1',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Các tầng mô hình TCP/IP',
        content: 'Trong mô hình TCP/IP chuẩn 4 tầng (Application, Transport, Internet, Network Access), giao thức IP thực hiện định tuyến gói tin thuộc tầng nào?',
        explanation: 'Giao thức IP chịu trách nhiệm đánh địa chỉ logic và định tuyến gói tin ở tầng Internet (tầng Mạng).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['Internet (tầng Mạng)', true],
                ['Application (tầng Ứng dụng)', false],
                ['Transport (tầng Giao vận)', false],
                ['Network Access (tầng Truy cập mạng)', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C1_B1',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'So sánh TCP và UDP',
        content: 'Những điểm khác biệt nào sau đây đúng giữa hai giao thức tầng Giao vận TCP và UDP?',
        explanation: 'TCP hướng kết nối (bắt tay 3 bước), đảm bảo thứ tự và truyền lại gói mất; UDP không kết nối, header gọn nhẹ và không đảm bảo gửi lại.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['TCP thiết lập kết nối bằng bắt tay ba bước (SYN, SYN-ACK, ACK) trước khi truyền dữ liệu', true],
                ['TCP đảm bảo thứ tự byte và truyền lại phân đoạn bị mất', true],
                ['UDP có độ trễ thấp hơn do không bắt tay kết nối và không kiểm soát tắc nghẽn theo từng gói', true],
                ['UDP bắt buộc phải truyền lại mỗi gói tin bị thất lạc trên đường truyền', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C1_B1',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Đơn vị dữ liệu PDU theo tầng',
        content: 'Khi dữ liệu đi xuống qua các tầng, đơn vị dữ liệu giao thức (PDU) ở tầng Transport của TCP được gọi là {{b1}}, còn khi được đóng gói thêm IP header ở tầng Internet gọi là {{b2}}.',
        explanation: 'Tầng Transport dùng Segment (TCP) hoặc Datagram (UDP); tầng Internet/Network đóng gói thành Packet.',
        spec: makeDropdown([
            ['b1', [['v1', 'Segment'], ['v2', 'Frame'], ['v3', 'Bit']], 'v1'],
            ['b2', [['v1', 'Packet'], ['v2', 'Frame'], ['v3', 'Port']], 'v1']
        ])
    },
    {
        lessonCode: 'MMT_C1_B1',
        typeCode: 'INPUT',
        difficulty: 'EASY',
        topic: 'Số tầng mô hình OSI',
        content: 'Mô hình tham chiếu OSI (Open Systems Interconnection) chia kiến trúc mạng thành tất cả bao nhiêu tầng? Nhập một số nguyên.',
        explanation: 'Mô hình OSI gồm 7 tầng từ Physical (tầng 1) tới Application (tầng 7).',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['7', 'bảy']
        }
    },
    {
        lessonCode: 'MMT_C1_B1',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Thiết bị và địa chỉ theo tầng',
        content: 'Ghép mỗi địa chỉ hoặc đơn vị định danh với tầng xử lý tương ứng trong mạng TCP/IP.',
        explanation: 'Số cổng (Port) dùng để phân kênh ứng dụng ở tầng Transport; địa chỉ IP định tuyến ở tầng Internet; địa chỉ MAC 48-bit định danh card mạng ở tầng Liên kết dữ liệu.',
        spec: makeMatching(
            [['l1', 'Số cổng (Port 0..65535)'], ['l2', 'Địa chỉ IP (IPv4/IPv6)'], ['l3', 'Địa chỉ MAC (48-bit)']],
            [['r1', 'Tầng Giao vận (Transport)'], ['r2', 'Tầng Mạng (Internet)'], ['r3', 'Tầng Truy cập mạng / Liên kết dữ liệu']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== MMT_C1_B2: Địa chỉ IPv4 và subnet ========================
    {
        lessonCode: 'MMT_C1_B2',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Subnet mask /24',
        content: 'Mặt nạ mạng (Subnet Mask) dạng thập phân có dấu chấm tương ứng với tiền tố CIDR /24 là giá trị nào?',
        explanation: '24 bit đầu bằng 1 tương ứng 3 octet đầu là 255 và octet cuối bằng 0: 255.255.255.0.',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['255.255.255.0', true],
                ['255.255.0.0', false],
                ['255.255.255.128', false],
                ['255.255.255.252', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C1_B2',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Dải địa chỉ IPv4 riêng (Private IP)',
        content: 'Theo chuẩn RFC 1918, những dải địa chỉ IPv4 nào sau đây được quy định là địa chỉ mạng riêng (Private IP) không định tuyến trực tiếp trên Internet công cộng?',
        explanation: 'Ba khối IPv4 private theo RFC 1918 là 10.0.0.0/8, 172.16.0.0/12 (172.16.x.x - 172.31.x.x) và 192.168.0.0/16.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['10.0.0.0/8', true],
                ['172.16.0.0/12', true],
                ['192.168.0.0/16', true],
                ['8.8.8.0/24', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C1_B2',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Địa chỉ mạng và Broadcast',
        content: 'Trong một mạng con IPv4 thông thường (không dùng /31 hoặc /32), địa chỉ có toàn bộ phần bit host bằng 0 là {{b1}}, còn địa chỉ có toàn bộ bit host bằng 1 dùng để gửi tin tới mọi thiết bị trong subnet gọi là {{b2}}.',
        explanation: 'Toàn bộ host bit = 0 là địa chỉ mạng (Network Address); toàn bộ host bit = 1 là địa chỉ quảng bá (Broadcast Address).',
        spec: makeDropdown([
            ['b1', [['v1', 'địa chỉ mạng (Network Address)'], ['v2', 'địa chỉ broadcast'], ['v3', 'default gateway bắt buộc']], 'v1'],
            ['b2', [['v1', 'địa chỉ quảng bá (Broadcast Address)'], ['v2', 'địa chỉ loopback'], ['v3', 'địa chỉ DNS']], 'v1']
        ])
    },
    {
        lessonCode: 'MMT_C1_B2',
        typeCode: 'INPUT',
        difficulty: 'HARD',
        topic: 'Tính số host khả dụng của subnet',
        content: 'Mạng con IPv4 192.168.10.0/26 có tối đa bao nhiêu địa chỉ IP khả dụng có thể gán cho các máy trạm (host), sau khi đã trừ đi địa chỉ mạng và địa chỉ broadcast?',
        explanation: 'Mặt nạ /26 để lại 32 - 26 = 6 bit host. Số địa chỉ host khả dụng là 2^6 - 2 = 64 - 2 = 62.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['62']
        }
    },
    {
        lessonCode: 'MMT_C1_B2',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Các địa chỉ IPv4 đặc biệt',
        content: 'Ghép mỗi địa chỉ IPv4 hoặc khối CIDR sau với vai trò chuẩn hóa của nó.',
        explanation: '127.0.0.1 là loopback nội bộ; 255.255.255.255 là limited broadcast; 192.168.1.0/24 có 254 host khả dụng.',
        spec: makeMatching(
            [['l1', '127.0.0.1'], ['l2', '192.168.1.0/24'], ['l3', '255.255.255.255']],
            [['r1', 'Địa chỉ loopback tự kiểm tra ngay trên máy cục bộ'], ['r2', 'Mạng con riêng có 254 địa chỉ host khả dụng'], ['r3', 'Địa chỉ broadcast giới hạn trong mạng cục bộ']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== MMT_C2_B1: Hệ thống tên miền DNS ========================
    {
        lessonCode: 'MMT_C2_B1',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Cổng mặc định và bản ghi DNS',
        content: 'Dịch vụ DNS chuẩn lắng nghe truy vấn tên miền ở cổng (port) mặc định số bao nhiêu?',
        explanation: 'DNS sử dụng cổng mặc định 53 (chủ yếu UDP cho truy vấn ngắn và TCP cho zone transfer hoặc phản hồi lớn).',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['53', true],
                ['80', false],
                ['443', false],
                ['22', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C2_B1',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Các loại bản ghi DNS phổ biến',
        content: 'Những phát biểu nào đúng về các loại bản ghi (Resource Record) thường dùng trong DNS?',
        explanation: 'Bản ghi A ánh xạ tên miền tới IPv4; AAAA ánh xạ tới IPv6; MX chỉ định máy chủ nhận thư; CNAME tạo bí danh trỏ sang tên miền chuẩn.',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['Bản ghi A dùng để ánh xạ tên miền sang địa chỉ IPv4 32-bit', true],
                ['Bản ghi AAAA dùng để ánh xạ tên miền sang địa chỉ IPv6 128-bit', true],
                ['Bản ghi MX chỉ định máy chủ thư điện tử nhận email cho tên miền', true],
                ['Bản ghi A dùng để mã hóa khóa TLS cho trình duyệt', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C2_B1',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Phân cấp truy vấn DNS và TTL',
        content: 'Trong chuỗi phân giải tên miền phân cấp, sau khi kiểm tra bộ nhớ đệm không có kết quả, resolver thường hỏi bắt đầu từ {{b1}}; thời gian tối đa mà một kết quả phân giải được phép lưu trong bộ nhớ đệm được xác định bởi giá trị {{b2}}.',
        explanation: 'Thứ tự phân cấp bắt đầu từ Root Name Server (.), rồi TLD (.vn/.com), rồi Authoritative; TTL (Time To Live) quyết định thời gian cache.',
        spec: makeDropdown([
            ['b1', [['v1', 'Root DNS Server'], ['v2', 'DHCP Client'], ['v3', 'ARP Broadcast']], 'v1'],
            ['b2', [['v1', 'TTL (Time To Live)'], ['v2', 'MTU'], ['v3', 'SYN Cookie']], 'v1']
        ])
    },
    {
        lessonCode: 'MMT_C2_B1',
        typeCode: 'INPUT',
        difficulty: 'EASY',
        topic: 'Tên bản ghi ánh xạ IPv4',
        content: 'Trong cấu hình DNS, ký hiệu loại bản ghi nào ánh xạ trực tiếp từ tên miền (ví dụ olms.edu.vn) sang địa chỉ IPv4? Nhập ký hiệu viết hoa ngắn gọn.',
        explanation: 'Bản ghi loại A (Address record) ánh xạ tên miền tới địa chỉ IPv4.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['A']
        }
    },
    {
        lessonCode: 'MMT_C2_B1',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Ánh xạ bản ghi DNS',
        content: 'Ghép mỗi bản ghi DNS với chức năng tương ứng.',
        explanation: 'A ánh xạ sang IPv4; CNAME tạo tên bí danh trỏ sang tên miền khác; NS chỉ định Name Server có thẩm quyền.',
        spec: makeMatching(
            [['l1', 'Bản ghi A'], ['l2', 'Bản ghi CNAME'], ['l3', 'Bản ghi NS']],
            [['r1', 'Ánh xạ tên miền tới địa chỉ IPv4'], ['r2', 'Tạo bí danh (alias) trỏ tới một tên miền chính thức khác'], ['r3', 'Ủy quyền và chỉ định máy chủ tên miền có thẩm quyền cho vùng DNS']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    },

    // ======================== MMT_C2_B2: Giao thức HTTP và HTTPS ========================
    {
        lessonCode: 'MMT_C2_B2',
        typeCode: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        topic: 'Bảo mật trong HTTPS',
        content: 'HTTPS bổ sung lớp bảo mật nào nằm bên dưới HTTP để mã hóa kênh truyền và xác thực máy chủ so với HTTP thuần?',
        explanation: 'HTTPS là HTTP chạy trên giao thức mã hóa TLS (trước đây gọi là SSL), lắng nghe mặc định ở cổng 443.',
        spec: key => ({
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: makeChoices(key, [
                ['TLS (Transport Layer Security)', true],
                ['ARP (Address Resolution Protocol)', false],
                ['ICMP (Internet Control Message Protocol)', false],
                ['FTP (File Transfer Protocol)', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C2_B2',
        typeCode: 'MULTI_CHOICE',
        difficulty: 'MEDIUM',
        topic: 'Phương thức HTTP an toàn và idempotent',
        content: 'Trong thiết kế REST API qua HTTP, những phương thức nào sau đây có tính lũy đẳng (idempotent - gọi lặp lại nhiều lần với cùng tham số vẫn tạo ra trạng thái tài nguyên cuối giống một lần gọi)?',
        explanation: 'GET, PUT và DELETE là idempotent theo chuẩn HTTP; ngược lại POST thông thường không idempotent (mỗi lần gọi có thể tạo bản ghi mới).',
        spec: key => ({
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: makeChoices(key, [
                ['GET', true],
                ['PUT', true],
                ['DELETE', true],
                ['POST', false]
            ])
        })
    },
    {
        lessonCode: 'MMT_C2_B2',
        typeCode: 'DROPDOWN',
        difficulty: 'MEDIUM',
        topic: 'Cổng mặc định và nhóm mã trạng thái HTTP',
        content: 'Cổng TCP mặc định của dịch vụ HTTP không mã hóa là {{b1}}; khi máy chủ từ chối yêu cầu vì thiếu hoặc hết hạn thông tin xác thực (authentication) thì mã trạng thái chuẩn được dùng là {{b2}}.',
        explanation: 'HTTP chuẩn chạy cổng 80 (HTTPS là 443); 401 Unauthorized biểu thị chưa xác thực hợp lệ, khác với 403 Forbidden (đã xác thực nhưng không đủ quyền).',
        spec: makeDropdown([
            ['b1', [['v1', '80'], ['v2', '443'], ['v3', '53']], 'v1'],
            ['b2', [['v1', '401 Unauthorized'], ['v2', '404 Not Found'], ['v3', '201 Created']], 'v1']
        ])
    },
    {
        lessonCode: 'MMT_C2_B2',
        typeCode: 'INPUT',
        difficulty: 'EASY',
        topic: 'Cổng mặc định HTTPS',
        content: 'Giao thức HTTPS mặc định lắng nghe kết nối trên cổng TCP số bao nhiêu?',
        explanation: 'Cổng mặc định của HTTPS là 443.',
        spec: {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['443']
        }
    },
    {
        lessonCode: 'MMT_C2_B2',
        typeCode: 'MATCHING',
        difficulty: 'MEDIUM',
        topic: 'Mã trạng thái HTTP phổ biến',
        content: 'Ghép mỗi nhóm mã trạng thái HTTP với ý nghĩa phản hồi chuẩn.',
        explanation: '201 là tạo tài nguyên thành công; 403 là từ chối quyền truy cập; 409 báo xung đột trạng thái hoặc dữ liệu.',
        spec: makeMatching(
            [['l1', '201 Created'], ['l2', '403 Forbidden'], ['l3', '409 Conflict']],
            [['r1', 'Yêu cầu hợp lệ và đã tạo mới tài nguyên thành công'], ['r2', 'Đã xác thực nhưng tài khoản không đủ quyền thực hiện thao tác'], ['r3', 'Xung đột dữ liệu trùng lặp hoặc trạng thái hiện tại không hợp lệ']],
            [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']]
        )
    }
];

const DEMO_QUESTIONS = RAW_QUESTIONS.map(buildQuestion);

function assertDatasetIntegrity() {
    const lessonCodes = new Set();
    let chapterCount = 0;
    let lessonCount = 0;

    for (const s of DEMO_SUBJECTS) {
        chapterCount += s.chapters.length;
        for (const c of s.chapters) {
            lessonCount += c.lessons.length;
            for (const l of c.lessons) {
                lessonCodes.add(l.code);
            }
        }
    }

    const perLessonTypes = new Map();
    for (const q of DEMO_QUESTIONS) {
        if (!lessonCodes.has(q.lesson_code)) {
            throw new Error(`Demo question ${q.key} references unknown lesson ${q.lesson_code}`);
        }
        const types = perLessonTypes.get(q.lesson_code) || new Set();
        types.add(q.type_code);
        perLessonTypes.set(q.lesson_code, types);
    }

    for (const code of lessonCodes) {
        const types = perLessonTypes.get(code) || new Set();
        if (types.size !== 5) {
            throw new Error(`Lesson ${code} must have all 5 question types, found ${types.size}`);
        }
    }

    return {
        teachers: DEMO_USERS.length,
        subjects: DEMO_SUBJECTS.length,
        chapters: chapterCount,
        lessons: lessonCount,
        questions: DEMO_QUESTIONS.length
    };
}

assertDatasetIntegrity();

module.exports = {
    DEMO_USERS,
    DEMO_SUBJECTS,
    DEMO_QUESTIONS,
    deterministicUuid,
    assertDatasetIntegrity
};
