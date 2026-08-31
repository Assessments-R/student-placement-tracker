const selectedDrive = document.getElementById("selectedDrive");
const selectedDriveDetails =
    document.getElementById("selectedDriveDetails");

const participationForm =
    document.getElementById("participationForm");
const participationTableBody =
    document.getElementById("participationTableBody");
const participationSearch =
    document.getElementById("participationSearch");
const participationCount =
    document.getElementById("participationCount");
const participationFormMessage =
    document.getElementById("participationFormMessage");

const offerForm = document.getElementById("offerForm");
const offerTableBody = document.getElementById("offerTableBody");
const offerFormMessage =
    document.getElementById("offerFormMessage");

const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

let students = [];
let drives = [];
let participationRecords = [];
let offerRecords = [];

function numberOrNull(value) {
    return value === "" ? null : Number(value);
}

function booleanValue(value) {
    return value === "true";
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

async function loadInitialData() {
    const [studentResult, driveResult] = await Promise.all([
        supabaseClient
            .from("students")
            .select("id, university_id, student_name, branch")
            .eq("is_active", true)
            .order("student_name"),

        supabaseClient
            .from("placement_drives")
            .select(`
                *,
                companies (
                    id,
                    company_name
                )
            `)
            .order("drive_date", { ascending: false })
    ]);

    const error = studentResult.error || driveResult.error;

    if (error) {
        selectedDriveDetails.className =
            "status-message error-message";
        selectedDriveDetails.textContent =
            `Unable to load tracker: ${error.message}`;
        return;
    }

    students = studentResult.data || [];
    drives = driveResult.data || [];

    populateStudentSelect();
    populateDriveSelect();
}

function populateStudentSelect() {
    const participationStudent =
        document.getElementById("participationStudent");

    participationStudent.innerHTML =
        `<option value="">Select a student</option>`;

    students.forEach(student => {
        const option = document.createElement("option");

        option.value = student.id;
        option.textContent =
            `${student.university_id} – ${student.student_name}`;

        participationStudent.appendChild(option);
    });
}

function populateDriveSelect() {
    selectedDrive.innerHTML =
        `<option value="">Select a placement drive</option>`;

    drives.forEach(drive => {
        const option = document.createElement("option");

        option.value = drive.id;
        option.textContent =
            `${drive.companies?.company_name || "Company"} – ` +
            `${drive.drive_name} – ${drive.job_role}`;

        selectedDrive.appendChild(option);
    });
}

function populateOfferStudentSelect() {
    const offerStudent = document.getElementById("offerStudent");
    const selectedStudentIds = new Set(
        participationRecords
            .filter(record =>
                record.participation_status === "Selected" ||
                record.current_stage === "Selected"
            )
            .map(record => record.student_id)
    );

    offerStudent.innerHTML =
        `<option value="">Select a student</option>`;

    students
        .filter(student => selectedStudentIds.has(student.id))
        .forEach(student => {
            const option = document.createElement("option");

            option.value = student.id;
            option.textContent =
                `${student.university_id} – ${student.student_name}`;

            offerStudent.appendChild(option);
        });
}

function updateSelectedDriveDetails() {
    const drive = drives.find(
        item => item.id === Number(selectedDrive.value)
    );

    if (!drive) {
        selectedDriveDetails.textContent = "";
        return;
    }

    const details = [
        drive.companies?.company_name,
        drive.job_role,
        drive.package_lpa !== null
            ? `${drive.package_lpa} LPA`
            : null,
        drive.drive_date,
        drive.drive_status
    ].filter(Boolean);

    selectedDriveDetails.textContent = details.join(" | ");

    document.getElementById("offerJobRole").value =
        drive.job_role || "";

    document.getElementById("offerPackage").value =
        drive.package_lpa ?? "";
}

async function loadDriveRecords() {
    const driveId = Number(selectedDrive.value);

    if (!driveId) {
        participationTableBody.innerHTML =
            `<tr><td colspan="9">Select a placement drive.</td></tr>`;

        offerTableBody.innerHTML =
            `<tr><td colspan="7">Select a placement drive.</td></tr>`;

        participationRecords = [];
        offerRecords = [];
        populateOfferStudentSelect();
        return;
    }

    participationTableBody.innerHTML =
        `<tr><td colspan="9">Loading participation...</td></tr>`;

    offerTableBody.innerHTML =
        `<tr><td colspan="7">Loading offers...</td></tr>`;

    const [participationResult, offerResult] = await Promise.all([
        supabaseClient
            .from("drive_participation")
            .select(`
                *,
                students (
                    university_id,
                    student_name,
                    branch
                )
            `)
            .eq("drive_id", driveId)
            .order("created_at"),

        supabaseClient
            .from("placement_offers")
            .select(`
                *,
                students (
                    university_id,
                    student_name
                )
            `)
            .eq("drive_id", driveId)
            .order("created_at")
    ]);

    const error = participationResult.error || offerResult.error;

    if (error) {
        participationFormMessage.className =
            "status-message error-message";
        participationFormMessage.textContent =
            `Unable to load records: ${error.message}`;
        return;
    }

    participationRecords = participationResult.data || [];
    offerRecords = offerResult.data || [];

    renderParticipationRecords(participationRecords);
    renderOfferRecords();
    populateOfferStudentSelect();
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function renderParticipationRecords(records) {
    participationTableBody.replaceChildren();

    participationCount.textContent =
        `${records.length} participation record${
            records.length === 1 ? "" : "s"
        }`;

    if (!records.length) {
        participationTableBody.innerHTML =
            `<tr><td colspan="9">No participation records found.</td></tr>`;
        return;
    }

    records.forEach(record => {
        const row = document.createElement("tr");

        addCell(row, record.students?.university_id);
        addCell(row, record.students?.student_name);
        addCell(row, record.students?.branch);
        addCell(row, record.registered ? "Yes" : "No");
        addCell(row, record.attended ? "Yes" : "No");
        addCell(row, record.current_stage);
        addCell(row, record.participation_status);
        addCell(row, record.assessment_score);

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener(
            "click",
            () => beginParticipationEdit(record.id)
        );

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        participationTableBody.appendChild(row);
    });
}

function beginParticipationEdit(recordId) {
    const record = participationRecords.find(
        item => item.id === Number(recordId)
    );

    if (!record) {
        return;
    }

    document.getElementById("participationRecordId").value =
        record.id;
    document.getElementById("participationStudent").value =
        record.student_id;
    document.getElementById("participationStudent").disabled = true;
    document.getElementById("eligibleStatus").value =
        String(record.eligible);
    document.getElementById("registeredStatus").value =
        String(record.registered);
    document.getElementById("attendedStatus").value =
        String(record.attended);
    document.getElementById("currentStage").value =
        record.current_stage;
    document.getElementById("participationStatus").value =
        record.participation_status;
    document.getElementById("assessmentScore").value =
        record.assessment_score ?? "";
    document.getElementById("participationRemarks").value =
        record.remarks ?? "";

    document.getElementById("participationFormTitle").textContent =
        "Edit Student Participation";
    document.getElementById("saveParticipationButton").textContent =
        "Update Participation";
    document.getElementById("cancelParticipationEdit").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetParticipationForm() {
    participationForm.reset();
    document.getElementById("participationRecordId").value = "";
    document.getElementById("participationStudent").disabled = false;
    document.getElementById("participationFormTitle").textContent =
        "Add Student Participation";
    document.getElementById("saveParticipationButton").textContent =
        "Save Participation";
    document.getElementById("cancelParticipationEdit").hidden = true;
}

participationForm.addEventListener("submit", async event => {
    event.preventDefault();

    const driveId = Number(selectedDrive.value);

    if (!driveId) {
        participationFormMessage.className =
            "status-message error-message";
        participationFormMessage.textContent =
            "Select a placement drive first.";
        return;
    }

    const button = document.getElementById("saveParticipationButton");
    button.disabled = true;

    const registered =
        booleanValue(document.getElementById("registeredStatus").value);

    const attended =
        booleanValue(document.getElementById("attendedStatus").value);

    const recordData = {
        student_id:
            Number(document.getElementById("participationStudent").value),
        drive_id: driveId,
        eligible:
            booleanValue(document.getElementById("eligibleStatus").value),
        registered,
        attended,
        current_stage:
            document.getElementById("currentStage").value,
        participation_status:
            document.getElementById("participationStatus").value,
        assessment_score:
            numberOrNull(
                document.getElementById("assessmentScore").value
            ),
        remarks:
            document.getElementById("participationRemarks").value.trim()
            || null,
        registered_at: registered
            ? new Date().toISOString()
            : null,
        attended_at: attended
            ? new Date().toISOString()
            : null,
        updated_at: new Date().toISOString()
    };

    const recordId =
        document.getElementById("participationRecordId").value;

    let result;

    if (recordId) {
        result = await supabaseClient
            .from("drive_participation")
            .update(recordData)
            .eq("id", recordId);
    } else {
        result = await supabaseClient
            .from("drive_participation")
            .insert(recordData);
    }

    if (result.error) {
        participationFormMessage.className =
            "status-message error-message";

        participationFormMessage.textContent =
            result.error.code === "23505"
                ? "This student is already added to the selected drive."
                : `Unable to save participation: ${result.error.message}`;

        button.disabled = false;
        return;
    }

    const savedParticipation = recordId
        ? Number(recordId)
        : (
            await supabaseClient
                .from("drive_participation")
                .select("id")
                .eq("student_id", recordData.student_id)
                .eq("drive_id", driveId)
                .single()
        ).data?.id;

    if (savedParticipation) {
        await supabaseClient
            .from("drive_stage_history")
            .insert({
                participation_id: savedParticipation,
                stage_name: recordData.current_stage,
                stage_status:
                    recordData.participation_status === "Rejected"
                        ? "Not Cleared"
                        : recordData.attended
                            ? "Attended"
                            : "Scheduled",
                stage_date: new Date().toISOString(),
                score: recordData.assessment_score,
                remarks: recordData.remarks
            });
    }

    resetParticipationForm();

    participationFormMessage.className =
        "status-message success-message";
    participationFormMessage.textContent =
        recordId
            ? "Participation updated successfully."
            : "Student added to the drive successfully.";

    button.disabled = false;
    await loadDriveRecords();
});

participationSearch.addEventListener("input", () => {
    const term = participationSearch.value.trim().toLowerCase();

    if (!term) {
        renderParticipationRecords(participationRecords);
        return;
    }

    const filtered = participationRecords.filter(record =>
        [
            record.students?.university_id,
            record.students?.student_name,
            record.students?.branch
        ].some(value =>
            String(value || "").toLowerCase().includes(term)
        )
    );

    renderParticipationRecords(filtered);
});

document
    .getElementById("cancelParticipationEdit")
    .addEventListener("click", () => {
        resetParticipationForm();
        participationFormMessage.textContent = "";
    });

function renderOfferRecords() {
    offerTableBody.replaceChildren();

    if (!offerRecords.length) {
        offerTableBody.innerHTML =
            `<tr><td colspan="7">No offers recorded for this drive.</td></tr>`;
        return;
    }

    offerRecords.forEach(offer => {
        const row = document.createElement("tr");

        addCell(row, offer.students?.university_id);
        addCell(row, offer.students?.student_name);
        addCell(row, offer.job_role);
        addCell(
            row,
            offer.package_lpa !== null
                ? `${offer.package_lpa} LPA`
                : "—"
        );
        addCell(row, offer.offer_date);
        addCell(row, offer.offer_status);

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener(
            "click",
            () => beginOfferEdit(offer.id)
        );

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        offerTableBody.appendChild(row);
    });
}

function beginOfferEdit(offerId) {
    const offer = offerRecords.find(
        item => item.id === Number(offerId)
    );

    if (!offer) {
        return;
    }

    document.getElementById("offerRecordId").value = offer.id;
    document.getElementById("offerStudent").value = offer.student_id;
    document.getElementById("offerStudent").disabled = true;
    document.getElementById("offerJobRole").value = offer.job_role;
    document.getElementById("offerPackage").value =
        offer.package_lpa ?? "";
    document.getElementById("offerDate").value =
        offer.offer_date ?? "";
    document.getElementById("joiningDate").value =
        offer.joining_date ?? "";
    document.getElementById("joiningLocation").value =
        offer.joining_location ?? "";
    document.getElementById("offerStatus").value =
        offer.offer_status;
    document.getElementById("offerLetterUrl").value =
        offer.offer_letter_url ?? "";
    document.getElementById("offerRemarks").value =
        offer.remarks ?? "";

    document.getElementById("offerFormTitle").textContent =
        "Edit Placement Offer";
    document.getElementById("saveOfferButton").textContent =
        "Update Offer";
    document.getElementById("cancelOfferEdit").hidden = false;
}

function resetOfferForm() {
    const drive = drives.find(
        item => item.id === Number(selectedDrive.value)
    );

    offerForm.reset();
    document.getElementById("offerRecordId").value = "";
    document.getElementById("offerStudent").disabled = false;
    document.getElementById("offerJobRole").value =
        drive?.job_role || "";
    document.getElementById("offerPackage").value =
        drive?.package_lpa ?? "";
    document.getElementById("offerStatus").value = "Offered";
    document.getElementById("offerFormTitle").textContent =
        "Record Placement Offer";
    document.getElementById("saveOfferButton").textContent =
        "Save Offer";
    document.getElementById("cancelOfferEdit").hidden = true;
}

offerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const driveId = Number(selectedDrive.value);

    if (!driveId) {
        offerFormMessage.className = "status-message error-message";
        offerFormMessage.textContent =
            "Select a placement drive first.";
        return;
    }

    const studentId =
        Number(document.getElementById("offerStudent").value);

    const offerData = {
        student_id: studentId,
        drive_id: driveId,
        job_role:
            document.getElementById("offerJobRole").value.trim(),
        package_lpa:
            numberOrNull(document.getElementById("offerPackage").value),
        offer_date:
            document.getElementById("offerDate").value || null,
        joining_date:
            document.getElementById("joiningDate").value || null,
        joining_location:
            document.getElementById("joiningLocation").value.trim()
            || null,
        offer_status:
            document.getElementById("offerStatus").value,
        offer_letter_url:
            document.getElementById("offerLetterUrl").value.trim()
            || null,
        remarks:
            document.getElementById("offerRemarks").value.trim()
            || null,
        updated_at: new Date().toISOString()
    };

    const offerId = document.getElementById("offerRecordId").value;
    const button = document.getElementById("saveOfferButton");

    button.disabled = true;

    let result;

    if (offerId) {
        result = await supabaseClient
            .from("placement_offers")
            .update(offerData)
            .eq("id", offerId);
    } else {
        result = await supabaseClient
            .from("placement_offers")
            .insert(offerData);
    }

    if (result.error) {
        offerFormMessage.className =
            "status-message error-message";
        offerFormMessage.textContent =
            result.error.code === "23505"
                ? "An offer already exists for this student and drive."
                : `Unable to save offer: ${result.error.message}`;

        button.disabled = false;
        return;
    }

    await supabaseClient
        .from("drive_participation")
        .update({
            current_stage: "Selected",
            participation_status: "Selected",
            attended: true,
            updated_at: new Date().toISOString()
        })
        .eq("student_id", studentId)
        .eq("drive_id", driveId);

    const { count } = await supabaseClient
        .from("placement_offers")
        .select("*", { count: "exact", head: true })
        .eq("student_id", studentId);

    await supabaseClient
        .from("students")
        .update({
            placement_status:
                count > 1 ? "Multiple Offers" : "Placed",
            updated_at: new Date().toISOString()
        })
        .eq("id", studentId);

    resetOfferForm();

    offerFormMessage.className =
        "status-message success-message";
    offerFormMessage.textContent =
        offerId
            ? "Placement offer updated successfully."
            : "Placement offer recorded successfully.";

    button.disabled = false;
    await loadDriveRecords();
});

document
    .getElementById("cancelOfferEdit")
    .addEventListener("click", () => {
        resetOfferForm();
        offerFormMessage.textContent = "";
    });

selectedDrive.addEventListener("change", async () => {
    resetParticipationForm();
    resetOfferForm();
    updateSelectedDriveDetails();
    await loadDriveRecords();
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseDriveTracker() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        await loadInitialData();
    }
}

initialiseDriveTracker();
