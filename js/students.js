const studentForm = document.getElementById("studentForm");
const studentTableBody = document.getElementById("studentTableBody");
const studentSearch = document.getElementById("studentSearch");
const studentCount = document.getElementById("studentCount");
const formMessage = document.getElementById("formMessage");
const saveStudentButton = document.getElementById("saveStudentButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const logoutButton = document.getElementById("logoutButton");
const welcomeMessage = document.getElementById("welcomeMessage");

let studentRecords = [];

function numberOrNull(value) {
    return value === "" ? null : Number(value);
}

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

function getStudentFormData() {
    return {
        university_id:
            document.getElementById("universityId").value.trim(),

        student_name:
            document.getElementById("studentName").value.trim(),

        email:
            document.getElementById("email").value.trim().toLowerCase(),

        mobile_number:
            document.getElementById("mobileNumber").value.trim() || null,

        branch:
            document.getElementById("branch").value,

        batch:
            document.getElementById("batch").value.trim(),

        section:
            document.getElementById("section").value.trim() || null,

        tenth_percentage:
            numberOrNull(
                document.getElementById("tenthPercentage").value
            ),

        inter_percentage:
            numberOrNull(
                document.getElementById("interPercentage").value
            ),

        diploma_percentage:
            numberOrNull(
                document.getElementById("diplomaPercentage").value
            ),

        current_semester:
            numberOrNull(
                document.getElementById("currentSemester").value
            ),

        btech_cgpa:
            numberOrNull(
                document.getElementById("btechCgpa").value
            ),

        active_backlogs:
            Number(
                document.getElementById("activeBacklogs").value || 0
            ),

        placement_status:
            document.getElementById("placementStatus").value,

        updated_at: new Date().toISOString()
    };
}

async function loadStudents() {
    studentTableBody.innerHTML =
        `<tr><td colspan="10">Loading student records...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("students")
        .select("*")
        .eq("is_active", true)
        .order("student_name", { ascending: true });

    if (error) {
        studentTableBody.innerHTML =
            `<tr><td colspan="10">Unable to load students.</td></tr>`;
        return;
    }

    studentRecords = data || [];
    displayStudents(studentRecords);
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function displayStudents(records) {
    studentTableBody.replaceChildren();

    studentCount.textContent =
        `${records.length} student${records.length === 1 ? "" : "s"} found`;

    if (records.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 10;
        cell.textContent = "No student records found.";

        row.appendChild(cell);
        studentTableBody.appendChild(row);
        return;
    }

    records.forEach(student => {
        const row = document.createElement("tr");

        addCell(row, student.university_id);
        addCell(row, student.student_name);
        addCell(row, student.branch);
        addCell(row, student.batch);
        addCell(row, student.email);
        addCell(row, student.mobile_number);
        addCell(row, student.btech_cgpa);
        addCell(row, student.active_backlogs);
        addCell(row, student.placement_status);

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.dataset.studentId = student.id;
        editButton.addEventListener("click", () => beginEdit(student.id));

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        studentTableBody.appendChild(row);
    });
}

function beginEdit(studentId) {
    const student = studentRecords.find(
        record => record.id === Number(studentId)
    );

    if (!student) {
        return;
    }

    document.getElementById("studentRecordId").value = student.id;
    document.getElementById("universityId").value =
        student.university_id ?? "";
    document.getElementById("studentName").value =
        student.student_name ?? "";
    document.getElementById("email").value = student.email ?? "";
    document.getElementById("mobileNumber").value =
        student.mobile_number ?? "";
    document.getElementById("branch").value = student.branch ?? "";
    document.getElementById("batch").value = student.batch ?? "";
    document.getElementById("section").value = student.section ?? "";
    document.getElementById("tenthPercentage").value =
        student.tenth_percentage ?? "";
    document.getElementById("interPercentage").value =
        student.inter_percentage ?? "";
    document.getElementById("diplomaPercentage").value =
        student.diploma_percentage ?? "";
    document.getElementById("currentSemester").value =
        student.current_semester ?? "";
    document.getElementById("btechCgpa").value =
        student.btech_cgpa ?? "";
    document.getElementById("activeBacklogs").value =
        student.active_backlogs ?? 0;
    document.getElementById("placementStatus").value =
        student.placement_status ?? "Not Placed";

    document.getElementById("formTitle").textContent = "Edit Student";
    saveStudentButton.textContent = "Update Student";
    cancelEditButton.hidden = false;
    formMessage.textContent = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetStudentForm() {
    studentForm.reset();
    document.getElementById("studentRecordId").value = "";
    document.getElementById("activeBacklogs").value = 0;
    document.getElementById("placementStatus").value = "Not Placed";
    document.getElementById("formTitle").textContent = "Add Student";
    saveStudentButton.textContent = "Save Student";
    cancelEditButton.hidden = true;
}

studentForm.addEventListener("submit", async event => {
    event.preventDefault();

    saveStudentButton.disabled = true;
    formMessage.className = "status-message";
    formMessage.textContent = "Saving student record...";

    const studentId =
        document.getElementById("studentRecordId").value;

    const studentData = getStudentFormData();

    let result;

    if (studentId) {
        result = await supabaseClient
            .from("students")
            .update(studentData)
            .eq("id", studentId);
    } else {
        result = await supabaseClient
            .from("students")
            .insert(studentData);
    }

    saveStudentButton.disabled = false;

    if (result.error) {
        formMessage.className = "status-message error-message";

        if (result.error.code === "23505") {
            formMessage.textContent =
                "University ID or email address already exists.";
        } else {
            formMessage.textContent =
                `Unable to save student: ${result.error.message}`;
        }

        return;
    }

    resetStudentForm();
    formMessage.className = "status-message success-message";
    formMessage.textContent =
        studentId
            ? "Student record updated successfully."
            : "Student record added successfully.";

    await loadStudents();
});

studentSearch.addEventListener("input", () => {
    const searchTerm = studentSearch.value.trim().toLowerCase();

    if (!searchTerm) {
        displayStudents(studentRecords);
        return;
    }

    const filteredRecords = studentRecords.filter(student => {
        return [
            student.university_id,
            student.student_name,
            student.email,
            student.branch,
            student.batch
        ].some(value =>
            String(value || "").toLowerCase().includes(searchTerm)
        );
    });

    displayStudents(filteredRecords);
});

cancelEditButton.addEventListener("click", () => {
    resetStudentForm();
    formMessage.textContent = "";
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseStudentPage() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        await loadStudents();
    }
}

initialiseStudentPage();
