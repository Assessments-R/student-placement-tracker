const welcomeMessage = document.getElementById("welcomeMessage");
const academicMessage = document.getElementById("academicMessage");
const logoutButton = document.getElementById("logoutButton");

const branchFilter = document.getElementById("academicBranchFilter");
const batchFilter = document.getElementById("academicBatchFilter");
const placementStatusFilter =
    document.getElementById("placementStatusFilter");
const companyPlacedFilter =
    document.getElementById("companyPlacedFilter");

const minimumTenthFilter =
    document.getElementById("minimumTenthFilter");
const minimumInterFilter =
    document.getElementById("minimumInterFilter");
const minimumDiplomaFilter =
    document.getElementById("minimumDiplomaFilter");
const minimumCgpaFilter =
    document.getElementById("minimumCgpaFilter");

const backlogFilter = document.getElementById("backlogFilter");
const exactBacklogGroup =
    document.getElementById("exactBacklogGroup");
const exactBacklogs = document.getElementById("exactBacklogs");

let students = [];
let offers = [];
let drives = [];
let filteredStudents = [];

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

async function loadAcademicData() {
    academicMessage.textContent = "Loading academic records...";

    const [
        studentResult,
        offerResult,
        driveResult
    ] = await Promise.all([
        supabaseClient
            .from("students")
            .select("*")
            .eq("is_active", true)
            .order("student_name"),

        supabaseClient
            .from("placement_offers")
            .select("id, student_id, drive_id, offer_status"),

        supabaseClient
            .from("placement_drives")
            .select(`
                id,
                company_id,
                companies (
                    id,
                    company_name
                )
            `)
    ]);

    const error =
        studentResult.error ||
        offerResult.error ||
        driveResult.error;

    if (error) {
        academicMessage.className =
            "status-message error-message";
        academicMessage.textContent =
            `Unable to load records: ${error.message}`;
        return;
    }

    students = studentResult.data || [];
    offers = offerResult.data || [];
    drives = driveResult.data || [];

    populateFilters();
    applyFilters();

    academicMessage.className =
        "status-message success-message";
    academicMessage.textContent =
        "Academic and backlog report loaded successfully.";
}

function populateFilters() {
    const branches = [
        ...new Set(students.map(student => student.branch).filter(Boolean))
    ].sort();

    const batches = [
        ...new Set(students.map(student => student.batch).filter(Boolean))
    ].sort();

    branches.forEach(branch => {
        const option = document.createElement("option");
        option.value = branch;
        option.textContent = branch;
        branchFilter.appendChild(option);
    });

    batches.forEach(batch => {
        const option = document.createElement("option");
        option.value = batch;
        option.textContent = batch;
        batchFilter.appendChild(option);
    });

    const companies = new Map();

    drives.forEach(drive => {
        if (drive.companies?.id) {
            companies.set(
                String(drive.companies.id),
                drive.companies.company_name
            );
        }
    });

    [...companies.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([companyId, companyName]) => {
            const option = document.createElement("option");
            option.value = companyId;
            option.textContent = companyName;
            companyPlacedFilter.appendChild(option);
        });
}

function numericFilterValue(element) {
    return element.value === "" ? null : Number(element.value);
}

function getStudentOffers(studentId) {
    return offers.filter(offer => offer.student_id === studentId);
}

function getDrive(driveId) {
    return drives.find(drive => drive.id === driveId);
}

function getStudentCompanyIds(studentId) {
    return getStudentOffers(studentId)
        .map(offer => getDrive(offer.drive_id)?.company_id)
        .filter(companyId => companyId !== undefined);
}

function getStudentCompanyNames(studentId) {
    const names = getStudentOffers(studentId)
        .map(offer => getDrive(offer.drive_id)?.companies?.company_name)
        .filter(Boolean);

    return [...new Set(names)];
}

function getCalculatedPlacementStatus(student) {
    const offerCount = getStudentOffers(student.id).length;

    if (offerCount > 1) {
        return "Multiple Offers";
    }

    if (offerCount === 1) {
        return "Placed";
    }

    return student.placement_status || "Not Placed";
}

function passesMinimum(value, minimum) {
    if (minimum === null) {
        return true;
    }

    return value !== null &&
        value !== undefined &&
        Number(value) >= minimum;
}

function applyFilters() {
    const minimumTenth = numericFilterValue(minimumTenthFilter);
    const minimumInter = numericFilterValue(minimumInterFilter);
    const minimumDiploma = numericFilterValue(minimumDiplomaFilter);
    const minimumCgpa = numericFilterValue(minimumCgpaFilter);

    filteredStudents = students.filter(student => {
        if (
            branchFilter.value &&
            student.branch !== branchFilter.value
        ) {
            return false;
        }

        if (
            batchFilter.value &&
            student.batch !== batchFilter.value
        ) {
            return false;
        }

        if (
            !passesMinimum(
                student.tenth_percentage,
                minimumTenth
            )
        ) {
            return false;
        }

        if (
            !passesMinimum(
                student.inter_percentage,
                minimumInter
            )
        ) {
            return false;
        }

        if (
            !passesMinimum(
                student.diploma_percentage,
                minimumDiploma
            )
        ) {
            return false;
        }

        if (
            !passesMinimum(
                student.btech_cgpa,
                minimumCgpa
            )
        ) {
            return false;
        }

        const backlogs = Number(student.active_backlogs || 0);

        if (backlogFilter.value === "none" && backlogs !== 0) {
            return false;
        }

        if (backlogFilter.value === "with" && backlogs < 1) {
            return false;
        }

        if (
            backlogFilter.value === "exact" &&
            backlogs !== Number(exactBacklogs.value || 0)
        ) {
            return false;
        }

        const calculatedStatus =
            getCalculatedPlacementStatus(student);

        if (
            placementStatusFilter.value &&
            calculatedStatus !== placementStatusFilter.value
        ) {
            return false;
        }

        const selectedCompany = companyPlacedFilter.value;

        if (selectedCompany === "not-placed") {
            if (getStudentOffers(student.id).length > 0) {
                return false;
            }
        } else if (selectedCompany) {
            const companyIds = getStudentCompanyIds(student.id)
                .map(String);

            if (!companyIds.includes(selectedCompany)) {
                return false;
            }
        }

        return true;
    });

    updateSummaryCards();
    renderDepartmentSummary();
    renderStudentTable();
}

function getInterOrDiplomaPercentage(student) {
    if (
        student.inter_percentage !== null &&
        student.inter_percentage !== undefined
    ) {
        return Number(student.inter_percentage);
    }

    if (
        student.diploma_percentage !== null &&
        student.diploma_percentage !== undefined
    ) {
        return Number(student.diploma_percentage);
    }

    return null;
}

function updateSummaryCards() {
    const countAtLeast = (field, value) =>
        filteredStudents.filter(student =>
            student[field] !== null &&
            student[field] !== undefined &&
            Number(student[field]) >= value
        ).length;

    const preUniversityAbove80 = filteredStudents.filter(student => {
        const percentage = getInterOrDiplomaPercentage(student);
        return percentage !== null && percentage >= 80;
    }).length;

    const preUniversityAbove85 = filteredStudents.filter(student => {
        const percentage = getInterOrDiplomaPercentage(student);
        return percentage !== null && percentage >= 85;
    }).length;

    const backlogStudents = filteredStudents.filter(
        student => Number(student.active_backlogs || 0) > 0
    ).length;

    document.getElementById("matchingStudents").textContent =
        filteredStudents.length;

    document.getElementById("tenthAbove80").textContent =
        countAtLeast("tenth_percentage", 80);

    document.getElementById("tenthAbove85").textContent =
        countAtLeast("tenth_percentage", 85);

    document.getElementById("interAbove80").textContent =
        preUniversityAbove80;

    document.getElementById("interAbove85").textContent =
        preUniversityAbove85;

    document.getElementById("cgpaAbove8").textContent =
        countAtLeast("btech_cgpa", 8);

    document.getElementById("cgpaAbove85").textContent =
        countAtLeast("btech_cgpa", 8.5);

    document.getElementById("studentsWithBacklogs").textContent =
        backlogStudents;
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function renderDepartmentSummary() {
    const body = document.getElementById("departmentBacklogBody");
    body.replaceChildren();

    const summary = {};

    filteredStudents.forEach(student => {
        const department = student.branch || "Not Specified";
        const backlogs = Number(student.active_backlogs || 0);

        if (!summary[department]) {
            summary[department] = {
                total: 0,
                noBacklogs: 0,
                withBacklogs: 0,
                totalBacklogs: 0
            };
        }

        summary[department].total += 1;
        summary[department].totalBacklogs += backlogs;

        if (backlogs > 0) {
            summary[department].withBacklogs += 1;
        } else {
            summary[department].noBacklogs += 1;
        }
    });

    const entries = Object.entries(summary).sort(
        ([departmentA], [departmentB]) =>
            departmentA.localeCompare(departmentB)
    );

    if (!entries.length) {
        body.innerHTML =
            `<tr><td colspan="5">No matching departments found.</td></tr>`;
        return;
    }

    entries.forEach(([department, values]) => {
        const row = document.createElement("tr");

        addCell(row, department);
        addCell(row, values.total);
        addCell(row, values.noBacklogs);
        addCell(row, values.withBacklogs);
        addCell(row, values.totalBacklogs);

        body.appendChild(row);
    });
}

function renderStudentTable() {
    const body = document.getElementById("academicStudentBody");
    body.replaceChildren();

    if (!filteredStudents.length) {
        body.innerHTML =
            `<tr><td colspan="10">No students match the filters.</td></tr>`;
        return;
    }

    filteredStudents.forEach(student => {
        const row = document.createElement("tr");
        const companies = getStudentCompanyNames(student.id);

        addCell(row, student.university_id);
        addCell(row, student.student_name);
        addCell(row, student.branch);
        addCell(row, student.batch);
        addCell(row, student.tenth_percentage);
        addCell(row, student.inter_percentage);
        addCell(row, student.diploma_percentage);
        addCell(row, student.btech_cgpa);
        addCell(row, student.active_backlogs);
        addCell(
            row,
            companies.length
                ? `${getCalculatedPlacementStatus(student)} – ${
                    companies.join(", ")
                }`
                : getCalculatedPlacementStatus(student)
        );

        body.appendChild(row);
    });
}

function escapeCsv(value) {
    const text = String(value ?? "");

    if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
    ) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}

function exportAcademicReport() {
    const headers = [
        "University ID",
        "Student Name",
        "Department",
        "Batch",
        "10th Percentage",
        "Intermediate Percentage",
        "Diploma Percentage",
        "B.Tech CGPA",
        "Active Backlogs",
        "Placement Status",
        "Placed Companies"
    ];

    const rows = filteredStudents.map(student => [
        student.university_id,
        student.student_name,
        student.branch,
        student.batch,
        student.tenth_percentage,
        student.inter_percentage,
        student.diploma_percentage,
        student.btech_cgpa,
        student.active_backlogs,
        getCalculatedPlacementStatus(student),
        getStudentCompanyNames(student.id).join("; ")
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(escapeCsv).join(","))
        .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
        `academic-backlog-report-${
            new Date().toISOString().slice(0, 10)
        }.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function clearFilters() {
    branchFilter.value = "";
    batchFilter.value = "";
    placementStatusFilter.value = "";
    companyPlacedFilter.value = "";
    minimumTenthFilter.value = "";
    minimumInterFilter.value = "";
    minimumDiplomaFilter.value = "";
    minimumCgpaFilter.value = "";
    backlogFilter.value = "all";
    exactBacklogs.value = 0;
    exactBacklogGroup.hidden = true;

    applyFilters();
}

[
    branchFilter,
    batchFilter,
    placementStatusFilter,
    companyPlacedFilter,
    minimumTenthFilter,
    minimumInterFilter,
    minimumDiplomaFilter,
    minimumCgpaFilter,
    exactBacklogs
].forEach(element => {
    element.addEventListener("input", applyFilters);
    element.addEventListener("change", applyFilters);
});

backlogFilter.addEventListener("change", () => {
    exactBacklogGroup.hidden = backlogFilter.value !== "exact";
    applyFilters();
});

document
    .getElementById("clearAcademicFilters")
    .addEventListener("click", clearFilters);

document
    .getElementById("exportAcademicReport")
    .addEventListener("click", exportAcademicReport);

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseAcademicPage() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        await loadAcademicData();
    }
}

initialiseAcademicPage();
