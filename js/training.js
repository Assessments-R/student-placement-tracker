const trainingForm = document.getElementById("trainingForm");
const trainingTableBody =
    document.getElementById("trainingTableBody");
const trainingFormMessage =
    document.getElementById("trainingFormMessage");
const trainingAttendanceBody =
    document.getElementById("trainingAttendanceBody");
const trainingAttendanceHeading =
    document.getElementById("trainingAttendanceHeading");
const trainingAttendanceMessage =
    document.getElementById("trainingAttendanceMessage");
const trainingSearch = document.getElementById("trainingSearch");
const trainingCategoryFilter =
    document.getElementById("trainingCategoryFilter");
const trainingStudentSearch =
    document.getElementById("trainingStudentSearch");
const sessionCategory = document.getElementById("sessionCategory");
const trainingCompanyGroup =
    document.getElementById("trainingCompanyGroup");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

let companies = [];
let students = [];
let trainingSessions = [];
let selectedTrainingId = null;

async function verifyStaffAccess() {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.replace("login.html");
        return false;
    }

    const { data: profile, error } = await supabaseClient
        .from("user_profiles")
        .select("full_name, role, is_active")
        .eq("id", session.user.id)
        .single();

    if (
        error ||
        !profile ||
        !profile.is_active ||
        !["Administrator", "Placement Staff"].includes(profile.role)
    ) {
        await supabaseClient.auth.signOut();
        window.location.replace("login.html");
        return false;
    }

    welcomeMessage.textContent =
        `Welcome, ${profile.full_name} — ${profile.role}`;

    return true;
}

async function loadInitialData() {
    const [companyResult, studentResult] = await Promise.all([
        supabaseClient
            .from("companies")
            .select("id, company_name")
            .order("company_name"),

        supabaseClient
            .from("students")
            .select(`
                id,
                university_id,
                student_name,
                branch,
                batch
            `)
            .eq("is_active", true)
            .order("student_name")
    ]);

    const error = companyResult.error || studentResult.error;

    if (error) {
        trainingFormMessage.className =
            "status-message error-message";
        trainingFormMessage.textContent =
            `Unable to load data: ${error.message}`;
        return;
    }

    companies = companyResult.data || [];
    students = studentResult.data || [];

    populateCompanySelect();
    await loadTrainingSessions();
}

function populateCompanySelect() {
    const companySelect = document.getElementById("trainingCompany");

    companySelect.innerHTML =
        `<option value="">Select a company</option>`;

    companies.forEach(company => {
        const option = document.createElement("option");
        option.value = company.id;
        option.textContent = company.company_name;
        companySelect.appendChild(option);
    });
}

async function loadTrainingSessions() {
    trainingTableBody.innerHTML =
        `<tr><td colspan="8">Loading training sessions...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("training_sessions")
        .select(`
            *,
            companies (
                id,
                company_name
            )
        `)
        .order("session_date", { ascending: false });

    if (error) {
        trainingTableBody.innerHTML =
            `<tr><td colspan="8">
                Unable to load training sessions.
            </td></tr>`;
        return;
    }

    trainingSessions = data || [];
    filterTrainingSessions();
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    return new Date(`${value}T00:00:00`)
        .toLocaleDateString("en-IN");
}

function renderTrainingSessions(records) {
    trainingTableBody.replaceChildren();

    if (!records.length) {
        trainingTableBody.innerHTML =
            `<tr><td colspan="8">
                No training sessions found.
            </td></tr>`;
        return;
    }

    records.forEach(session => {
        const row = document.createElement("tr");

        addCell(row, formatDate(session.session_date));
        addCell(row, session.session_category);
        addCell(row, session.companies?.company_name);
        addCell(row, session.training_title);
        addCell(row, session.training_type);
        addCell(row, session.eligible_batch);
        addCell(row, session.session_status);

        const actionsCell = document.createElement("td");

        const attendanceButton = document.createElement("button");
        attendanceButton.type = "button";
        attendanceButton.textContent = "Attendance";
        attendanceButton.addEventListener(
            "click",
            () => loadTrainingAttendance(session.id)
        );

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.style.marginLeft = "8px";
        editButton.addEventListener(
            "click",
            () => beginTrainingEdit(session.id)
        );

        actionsCell.append(attendanceButton, editButton);
        row.appendChild(actionsCell);
        trainingTableBody.appendChild(row);
    });
}

function filterTrainingSessions() {
    const term = trainingSearch.value.trim().toLowerCase();
    const category = trainingCategoryFilter.value;

    const filtered = trainingSessions.filter(session => {
        const categoryMatches =
            !category || session.session_category === category;

        const searchMatches =
            !term ||
            [
                session.training_title,
                session.training_type,
                session.trainer_name,
                session.companies?.company_name
            ].some(value =>
                String(value || "").toLowerCase().includes(term)
            );

        return categoryMatches && searchMatches;
    });

    renderTrainingSessions(filtered);
}

function getTrainingFormData() {
    const branchText =
        document.getElementById("trainingBranches").value.trim();

    const branches = branchText
        ? branchText
            .split(",")
            .map(branch => branch.trim())
            .filter(Boolean)
        : null;

    const category = sessionCategory.value;
    const companyId =
        document.getElementById("trainingCompany").value;

    if (category === "Company Specific" && !companyId) {
        throw new Error(
            "Select a company for company-specific training."
        );
    }

    return {
        training_title:
            document.getElementById("trainingTitle").value.trim(),
        training_type:
            document.getElementById("trainingType").value,
        session_category: category,
        company_id:
            category === "Company Specific"
                ? Number(companyId)
                : null,
        trainer_name:
            document.getElementById("trainerName").value.trim()
            || null,
        venue:
            document.getElementById("trainingVenue").value.trim()
            || null,
        session_date:
            document.getElementById("trainingDate").value,
        start_time:
            document.getElementById("trainingStartTime").value
            || null,
        end_time:
            document.getElementById("trainingEndTime").value
            || null,
        eligible_branches: branches,
        eligible_batch:
            document.getElementById("trainingBatch").value.trim()
            || null,
        session_status:
            document.getElementById("trainingStatus").value,
        description:
            document.getElementById("trainingDescription").value.trim()
            || null,
        updated_at: new Date().toISOString()
    };
}

trainingForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = document.getElementById("saveTrainingButton");
    button.disabled = true;

    try {
        const sessionData = getTrainingFormData();
        const recordId =
            document.getElementById("trainingRecordId").value;

        let result;

        if (recordId) {
            result = await supabaseClient
                .from("training_sessions")
                .update(sessionData)
                .eq("id", recordId);
        } else {
            result = await supabaseClient
                .from("training_sessions")
                .insert(sessionData);
        }

        if (result.error) {
            throw result.error;
        }

        resetTrainingForm();

        trainingFormMessage.className =
            "status-message success-message";
        trainingFormMessage.textContent =
            recordId
                ? "Training session updated successfully."
                : "Training session created successfully.";

        await loadTrainingSessions();

    } catch (error) {
        trainingFormMessage.className =
            "status-message error-message";
        trainingFormMessage.textContent =
            `Unable to save training: ${error.message}`;

    } finally {
        button.disabled = false;
    }
});

function beginTrainingEdit(sessionId) {
    const session = trainingSessions.find(
        item => item.id === Number(sessionId)
    );

    if (!session) {
        return;
    }

    document.getElementById("trainingRecordId").value =
        session.id;
    sessionCategory.value =
        session.session_category || "General";
    document.getElementById("trainingCompany").value =
        session.company_id ?? "";
    document.getElementById("trainingTitle").value =
        session.training_title ?? "";
    document.getElementById("trainingType").value =
        session.training_type ?? "Other";
    document.getElementById("trainerName").value =
        session.trainer_name ?? "";
    document.getElementById("trainingDate").value =
        session.session_date ?? "";
    document.getElementById("trainingStartTime").value =
        session.start_time?.slice(0, 5) ?? "";
    document.getElementById("trainingEndTime").value =
        session.end_time?.slice(0, 5) ?? "";
    document.getElementById("trainingVenue").value =
        session.venue ?? "";
    document.getElementById("trainingBranches").value =
        session.eligible_branches?.join(", ") ?? "";
    document.getElementById("trainingBatch").value =
        session.eligible_batch ?? "";
    document.getElementById("trainingStatus").value =
        session.session_status ?? "Scheduled";
    document.getElementById("trainingDescription").value =
        session.description ?? "";

    updateCompanyVisibility();

    document.getElementById("trainingFormTitle").textContent =
        "Edit Training Session";
    document.getElementById("saveTrainingButton").textContent =
        "Update Training Session";
    document.getElementById("cancelTrainingEdit").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetTrainingForm() {
    trainingForm.reset();
    document.getElementById("trainingRecordId").value = "";
    sessionCategory.value = "General";
    document.getElementById("trainingStatus").value = "Scheduled";
    document.getElementById("trainingFormTitle").textContent =
        "Create Training Session";
    document.getElementById("saveTrainingButton").textContent =
        "Save Training Session";
    document.getElementById("cancelTrainingEdit").hidden = true;
    updateCompanyVisibility();
}

function updateCompanyVisibility() {
    const companySpecific =
        sessionCategory.value === "Company Specific";

    trainingCompanyGroup.hidden = !companySpecific;
    document.getElementById("trainingCompany").required =
        companySpecific;
}

sessionCategory.addEventListener("change", updateCompanyVisibility);

document
    .getElementById("cancelTrainingEdit")
    .addEventListener("click", () => {
        resetTrainingForm();
        trainingFormMessage.textContent = "";
    });

trainingSearch.addEventListener("input", filterTrainingSessions);
trainingCategoryFilter.addEventListener(
    "change",
    filterTrainingSessions
);

function getEligibleStudents(session) {
    return students.filter(student => {
        const branchMatches =
            !session.eligible_branches?.length ||
            session.eligible_branches.some(
                branch =>
                    branch.toLowerCase() ===
                    String(student.branch || "").toLowerCase()
            );

        const batchMatches =
            !session.eligible_batch ||
            session.eligible_batch === student.batch;

        return branchMatches && batchMatches;
    });
}

async function loadTrainingAttendance(sessionId) {
    selectedTrainingId = Number(sessionId);

    const session = trainingSessions.find(
        item => item.id === selectedTrainingId
    );

    if (!session) {
        return;
    }

    trainingAttendanceHeading.textContent =
        `Attendance: ${session.training_title} – ${
            formatDate(session.session_date)
        }`;

    trainingAttendanceMessage.textContent =
        "Loading attendance...";

    const { data, error } = await supabaseClient
        .from("training_attendance")
        .select("*")
        .eq("training_session_id", selectedTrainingId);

    if (error) {
        trainingAttendanceMessage.className =
            "status-message error-message";
        trainingAttendanceMessage.textContent =
            `Unable to load attendance: ${error.message}`;
        return;
    }

    const attendanceMap = new Map(
        (data || []).map(record => [record.student_id, record])
    );

    renderTrainingAttendance(
        getEligibleStudents(session),
        attendanceMap
    );
}

function createAttendanceSelect(selectedValue) {
    const select = document.createElement("select");
    select.className = "training-attendance-status";

    const choices = [
        ["", "Select attendance"],
        ["Present", "Present"],
        ["Absent", "Absent"],
        ["Late", "Late"],
        ["Excused", "Excused"]
    ];

    choices.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === selectedValue;
        select.appendChild(option);
    });

    return select;
}

function renderTrainingAttendance(eligibleStudents, attendanceMap) {
    trainingAttendanceBody.replaceChildren();

    if (!eligibleStudents.length) {
        trainingAttendanceBody.innerHTML =
            `<tr><td colspan="7">
                No students match this session's eligibility.
            </td></tr>`;
        return;
    }

    eligibleStudents.forEach(student => {
        const saved = attendanceMap.get(student.id);
        const row = document.createElement("tr");

        row.dataset.studentId = student.id;
        row.dataset.search = [
            student.university_id,
            student.student_name,
            student.branch,
            student.batch
        ].join(" ").toLowerCase();

        addCell(row, student.university_id);
        addCell(row, student.student_name);
        addCell(row, student.branch);
        addCell(row, student.batch);

        const attendanceCell = document.createElement("td");
        attendanceCell.appendChild(
            createAttendanceSelect(saved?.attendance_status || "")
        );
        row.appendChild(attendanceCell);

        const scoreCell = document.createElement("td");
        const scoreInput = document.createElement("input");
        scoreInput.type = "number";
        scoreInput.min = "0";
        scoreInput.max = "100";
        scoreInput.step = "0.01";
        scoreInput.className = "training-score";
        scoreInput.value = saved?.assessment_score ?? "";
        scoreCell.appendChild(scoreInput);
        row.appendChild(scoreCell);

        const remarksCell = document.createElement("td");
        const remarksInput = document.createElement("input");
        remarksInput.type = "text";
        remarksInput.className = "training-remarks";
        remarksInput.value = saved?.remarks ?? "";
        remarksCell.appendChild(remarksInput);
        row.appendChild(remarksCell);

        trainingAttendanceBody.appendChild(row);
    });

    trainingAttendanceMessage.className = "status-message";
    trainingAttendanceMessage.textContent =
        `${eligibleStudents.length} eligible student${
            eligibleStudents.length === 1 ? "" : "s"
        }`;
}

document
    .getElementById("markTrainingAllPresent")
    .addEventListener("click", () => {
        trainingAttendanceBody
            .querySelectorAll(
                "tr:not([hidden]) .training-attendance-status"
            )
            .forEach(select => {
                select.value = "Present";
            });
    });

trainingStudentSearch.addEventListener("input", () => {
    const term = trainingStudentSearch.value.trim().toLowerCase();

    trainingAttendanceBody.querySelectorAll("tr").forEach(row => {
        if (!row.dataset.search) {
            return;
        }

        row.hidden =
            Boolean(term) && !row.dataset.search.includes(term);
    });
});

document
    .getElementById("saveTrainingAttendance")
    .addEventListener("click", async () => {
        if (!selectedTrainingId) {
            trainingAttendanceMessage.className =
                "status-message error-message";
            trainingAttendanceMessage.textContent =
                "Select a training session first.";
            return;
        }

        const rows = [
            ...trainingAttendanceBody.querySelectorAll(
                "tr[data-student-id]"
            )
        ];

        const records = rows
            .map(row => {
                const attendanceStatus =
                    row.querySelector(
                        ".training-attendance-status"
                    ).value;

                if (!attendanceStatus) {
                    return null;
                }

                const scoreValue =
                    row.querySelector(".training-score").value;

                return {
                    training_session_id: selectedTrainingId,
                    student_id: Number(row.dataset.studentId),
                    attendance_status: attendanceStatus,
                    assessment_score:
                        scoreValue === ""
                            ? null
                            : Number(scoreValue),
                    remarks:
                        row.querySelector(
                            ".training-remarks"
                        ).value.trim() || null,
                    updated_at: new Date().toISOString()
                };
            })
            .filter(Boolean);

        if (!records.length) {
            trainingAttendanceMessage.className =
                "status-message error-message";
            trainingAttendanceMessage.textContent =
                "Mark attendance for at least one student.";
            return;
        }

        trainingAttendanceMessage.className = "status-message";
        trainingAttendanceMessage.textContent =
            "Saving attendance...";

        const { error } = await supabaseClient
            .from("training_attendance")
            .upsert(records, {
                onConflict: "training_session_id,student_id"
            });

        if (error) {
            trainingAttendanceMessage.className =
                "status-message error-message";
            trainingAttendanceMessage.textContent =
                `Unable to save attendance: ${error.message}`;
            return;
        }

        trainingAttendanceMessage.className =
            "status-message success-message";
        trainingAttendanceMessage.textContent =
            `${records.length} attendance record${
                records.length === 1 ? "" : "s"
            } saved successfully.`;
    });

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseTrainingPage() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        updateCompanyVisibility();
        await loadInitialData();
    }
}

initialiseTrainingPage();
