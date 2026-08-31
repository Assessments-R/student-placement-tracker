const branchFilter = document.getElementById("branchFilter");
const batchFilter = document.getElementById("batchFilter");
const reportMessage = document.getElementById("reportMessage");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

let students = [];
let offers = [];
let drives = [];
let participation = [];
let currentReportRows = [];

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

async function loadReportData() {
    reportMessage.textContent = "Loading placement reports...";

    const [
        studentResult,
        offerResult,
        driveResult,
        participationResult
    ] = await Promise.all([
        supabaseClient
            .from("students")
            .select("*")
            .eq("is_active", true),

        supabaseClient
            .from("placement_offers")
            .select("id, student_id, drive_id, package_lpa, offer_status"),

        supabaseClient
            .from("placement_drives")
            .select(`
                id,
                company_id,
                drive_name,
                companies (
                    company_name
                )
            `),

        supabaseClient
            .from("drive_participation")
            .select("student_id, drive_id, attended")
    ]);

    const error =
        studentResult.error ||
        offerResult.error ||
        driveResult.error ||
        participationResult.error;

    if (error) {
        reportMessage.className = "status-message error-message";
        reportMessage.textContent =
            `Unable to load reports: ${error.message}`;
        return;
    }

    students = studentResult.data || [];
    offers = offerResult.data || [];
    drives = driveResult.data || [];
    participation = participationResult.data || [];

    populateFilters();
    updateReports();

    reportMessage.className = "status-message success-message";
    reportMessage.textContent = "Reports loaded successfully.";
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
}

function getFilteredStudents() {
    return students.filter(student => {
        const branchMatches =
            !branchFilter.value ||
            student.branch === branchFilter.value;

        const batchMatches =
            !batchFilter.value ||
            student.batch === batchFilter.value;

        return branchMatches && batchMatches;
    });
}

function getStudentOfferCount(studentId) {
    return offers.filter(offer => offer.student_id === studentId).length;
}

function getStudentDriveCount(studentId) {
    return participation.filter(record =>
        record.student_id === studentId && record.attended === true
    ).length;
}

function updateReports() {
    const filteredStudents = getFilteredStudents();
    const filteredStudentIds = new Set(
        filteredStudents.map(student => student.id)
    );

    const filteredOffers = offers.filter(offer =>
        filteredStudentIds.has(offer.student_id)
    );

    const placedStudentIds = new Set(
        filteredOffers.map(offer => offer.student_id)
    );

    const packages = filteredOffers
        .map(offer => Number(offer.package_lpa))
        .filter(value => Number.isFinite(value) && value >= 0);

    const totalStudents = filteredStudents.length;
    const placedStudents = placedStudentIds.size;
    const unplacedStudents = totalStudents - placedStudents;

    const placementPercentage = totalStudents
        ? ((placedStudents / totalStudents) * 100).toFixed(1)
        : "0.0";

    const highestPackage = packages.length
        ? Math.max(...packages).toFixed(2)
        : "0.00";

    const averagePackage = packages.length
        ? (
            packages.reduce((sum, value) => sum + value, 0) /
            packages.length
        ).toFixed(2)
        : "0.00";

    document.getElementById("reportTotalStudents").textContent =
        totalStudents;
    document.getElementById("reportPlacedStudents").textContent =
        placedStudents;
    document.getElementById("reportUnplacedStudents").textContent =
        unplacedStudents;
    document.getElementById("reportPlacementPercentage").textContent =
        `${placementPercentage}%`;
    document.getElementById("reportTotalOffers").textContent =
        filteredOffers.length;
    document.getElementById("reportHighestPackage").textContent =
        `${highestPackage} LPA`;
    document.getElementById("reportAveragePackage").textContent =
        `${averagePackage} LPA`;
    document.getElementById("reportTotalDrives").textContent =
        drives.length;

    renderBranchReport(filteredStudents, placedStudentIds);
    renderCompanyReport(filteredOffers);
    renderStudentReport(filteredStudents);
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function renderBranchReport(filteredStudents, placedStudentIds) {
    const body = document.getElementById("branchReportBody");
    body.replaceChildren();

    const summary = {};

    filteredStudents.forEach(student => {
        const branch = student.branch || "Not Specified";

        if (!summary[branch]) {
            summary[branch] = {
                total: 0,
                placed: 0
            };
        }

        summary[branch].total += 1;

        if (placedStudentIds.has(student.id)) {
            summary[branch].placed += 1;
        }
    });

    const entries = Object.entries(summary).sort(
        ([branchA], [branchB]) => branchA.localeCompare(branchB)
    );

    if (!entries.length) {
        body.innerHTML =
            `<tr><td colspan="5">No branch records found.</td></tr>`;
        return;
    }

    entries.forEach(([branch, values]) => {
        const row = document.createElement("tr");
        const unplaced = values.total - values.placed;
        const percentage = values.total
            ? ((values.placed / values.total) * 100).toFixed(1)
            : "0.0";

        addCell(row, branch);
        addCell(row, values.total);
        addCell(row, values.placed);
        addCell(row, unplaced);
        addCell(row, `${percentage}%`);

        body.appendChild(row);
    });
}

function renderCompanyReport(filteredOffers) {
    const body = document.getElementById("companyReportBody");
    body.replaceChildren();

    const companySummary = new Map();

    drives.forEach(drive => {
        const companyId = drive.company_id;
        const companyName =
            drive.companies?.company_name || "Unknown Company";

        if (!companySummary.has(companyId)) {
            companySummary.set(companyId, {
                name: companyName,
                drives: 0,
                offers: 0,
                packages: []
            });
        }

        companySummary.get(companyId).drives += 1;
    });

    filteredOffers.forEach(offer => {
        const drive = drives.find(item => item.id === offer.drive_id);

        if (!drive) {
            return;
        }

        const company = companySummary.get(drive.company_id);

        if (!company) {
            return;
        }

        company.offers += 1;

        const packageValue = Number(offer.package_lpa);

        if (Number.isFinite(packageValue)) {
            company.packages.push(packageValue);
        }
    });

    const companies = [...companySummary.values()].sort(
        (a, b) => a.name.localeCompare(b.name)
    );

    if (!companies.length) {
        body.innerHTML =
            `<tr><td colspan="4">No company records found.</td></tr>`;
        return;
    }

    companies.forEach(company => {
        const row = document.createElement("tr");

        const highestPackage = company.packages.length
            ? `${Math.max(...company.packages).toFixed(2)} LPA`
            : "—";

        addCell(row, company.name);
        addCell(row, company.drives);
        addCell(row, company.offers);
        addCell(row, highestPackage);

        body.appendChild(row);
    });
}

function renderStudentReport(filteredStudents) {
    const body = document.getElementById("studentReportBody");
    body.replaceChildren();

    currentReportRows = filteredStudents.map(student => {
        const offerCount = getStudentOfferCount(student.id);
        const driveCount = getStudentDriveCount(student.id);

        return {
            university_id: student.university_id,
            student_name: student.student_name,
            branch: student.branch,
            batch: student.batch,
            btech_cgpa: student.btech_cgpa,
            drives_attended: driveCount,
            offers: offerCount,
            status: offerCount > 0
                ? offerCount > 1
                    ? "Multiple Offers"
                    : "Placed"
                : student.placement_status
        };
    });

    if (!currentReportRows.length) {
        body.innerHTML =
            `<tr><td colspan="8">No student records found.</td></tr>`;
        return;
    }

    currentReportRows.forEach(student => {
        const row = document.createElement("tr");

        addCell(row, student.university_id);
        addCell(row, student.student_name);
        addCell(row, student.branch);
        addCell(row, student.batch);
        addCell(row, student.btech_cgpa);
        addCell(row, student.drives_attended);
        addCell(row, student.offers);
        addCell(row, student.status);

        body.appendChild(row);
    });
}

function escapeCsvValue(value) {
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

function exportStudentReport() {
    const headers = [
        "University ID",
        "Student Name",
        "Branch",
        "Batch",
        "B.Tech CGPA",
        "Drives Attended",
        "Offers",
        "Placement Status"
    ];

    const rows = currentReportRows.map(student => [
        student.university_id,
        student.student_name,
        student.branch,
        student.batch,
        student.btech_cgpa,
        student.drives_attended,
        student.offers,
        student.status
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(escapeCsvValue).join(","))
        .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `placement-report-${
        new Date().toISOString().slice(0, 10)
    }.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

branchFilter.addEventListener("change", updateReports);
batchFilter.addEventListener("change", updateReports);

document
    .getElementById("exportStudentsButton")
    .addEventListener("click", exportStudentReport);

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseReportsPage() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        await loadReportData();
    }
}

initialiseReportsPage();
