const driveSelect = document.getElementById("roundDriveSelect");
const roundDriveDetails = document.getElementById("roundDriveDetails");
const roundForm = document.getElementById("roundForm");
const roundFormMessage = document.getElementById("roundFormMessage");
const roundTableBody = document.getElementById("roundTableBody");
const roundAttendanceBody =
    document.getElementById("roundAttendanceBody");
const attendanceHeading =
    document.getElementById("attendanceHeading");
const attendanceMessage =
    document.getElementById("attendanceMessage");
const roundStudentSearch =
    document.getElementById("roundStudentSearch");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

let drives = [];
let rounds = [];
let participationRecords = [];
let selectedRoundId = null;

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

async function loadDrives() {
    const { data, error } = await supabaseClient
        .from("placement_drives")
        .select(`
            *,
            companies (
                company_name
            )
        `)
        .order("drive_date", { ascending: false });

    if (error) {
        roundDriveDetails.className =
            "status-message error-message";
        roundDriveDetails.textContent =
            `Unable to load drives: ${error.message}`;
        return;
    }

    drives = data || [];

    driveSelect.innerHTML =
        `<option value="">Select a placement drive</option>`;

    drives.forEach(drive => {
        const option = document.createElement("option");

        option.value = drive.id;
        option.textContent =
            `${drive.companies?.company_name || "Company"} – ` +
            `${drive.drive_name} – ${drive.job_role}`;

        driveSelect.appendChild(option);
    });
}

async function loadDriveData() {
    const driveId = Number(driveSelect.value);
    selectedRoundId = null;

    if (!driveId) {
        rounds = [];
        participationRecords = [];

        roundTableBody.innerHTML =
            `<tr><td colspan="7">Select a placement drive.</td></tr>`;

        roundAttendanceBody.innerHTML =
            `<tr><td colspan="7">Select a drive round.</td></tr>`;

        attendanceHeading.textContent =
            "Select a round to mark attendance";

        roundDriveDetails.textContent = "";
        return;
    }

    const drive = drives.find(item => item.id === driveId);

    roundDriveDetails.textContent = [
        drive?.companies?.company_name,
        drive?.job_role,
        drive?.drive_date,
        drive?.drive_status
    ].filter(Boolean).join(" | ");

    const [roundResult, participationResult] = await Promise.all([
        supabaseClient
            .from("drive_rounds")
            .select("*")
            .eq("drive_id", driveId)
            .order("round_number"),

        supabaseClient
            .from("drive_participation")
            .select(`
                id,
                student_id,
                registered,
                attended,
                participation_status,
                students (
                    university_id,
                    student_name,
                    branch
                )
            `)
            .eq("drivedrive_id", driveId)
            .order("created_at")
    ]);

    const error = roundResult.error || participationResult.error;

    if (error) {
        roundFormMessage.className =
            "status-message error-message";
        roundFormMessage.textContent =
            `Unable to load drive records: ${error.message}`;
        return;
    }

    rounds = roundResult.data || [];
    participationRecords = participationResult.data || [];

    renderRounds();
}

function formatSchedule(value) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleString("en-IN");
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function renderRounds() {
    roundTableBody.replaceChildren();

    if (!rounds.length) {
        roundTableBody.innerHTML =
            `<tr><td colspan="7">No rounds created for this drive.</td></tr>`;
        return;
    }

    rounds.forEach(round => {
        const row = document.createElement("tr");

        addCell(row, round.round_number);
        addCell(row, round.round_name);
        addCell(row, round.round_type);
        addCell(row, formatSchedule(round.scheduled_at));
        addCell(row, round.venue);
        addCell(row, round.round_status);

        const actionsCell = document.createElement("td");

        const attendanceButton = document.createElement("button");
        attendanceButton.type = "button";
        attendanceButton.textContent = "Attendance";
        attendanceButton.addEventListener(
            "click",
            () => loadRoundAttendance(round.id)
        );

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.style.marginLeft = "8px";
        editButton.addEventListener(
            "click",
            () => beginRoundEdit(round.id)
        );

        actionsCell.append(attendanceButton, editButton);
        row.appendChild(actionsCell);
        roundTableBody.appendChild(row);
    });
}

function beginRoundEdit(roundId) {
    const round = rounds.find(item => item.id === Number(roundId));

    if (!round) {
        return;
    }

    document.getElementById("roundRecordId").value = round.id;
    document.getElementById("roundNumber").value =
        round.round_number;
    document.getElementById("roundName").value =
        round.round_name;
    document.getElementById("roundType").value =
        round.round_type || "";
    document.getElementById("roundVenue").value =
        round.venue || "";
    document.getElementById("roundStatus").value =
        round.round_status;

    if (round.scheduled_at) {
        const date = new Date(round.scheduled_at);
        const localDate = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        );

        document.getElementById("roundScheduledAt").value =
            localDate.toISOString().slice(0, 16);
    } else {
        document.getElementById("roundScheduledAt").value = "";
    }

    document.getElementById("roundFormTitle").textContent =
        "Edit Drive Round";
    document.getElementById("saveRoundButton").textContent =
        "Update Round";
    document.getElementById("cancelRoundEdit").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetRoundForm() {
    roundForm.reset();
    document.getElementById("roundRecordId").value = "";
    document.getElementById("roundStatus").value = "Scheduled";
    document.getElementById("roundFormTitle").textContent =
        "Create Drive Round";
    document.getElementById("saveRoundButton").textContent =
        "Save Round";
    document.getElementById("cancelRoundEdit").hidden = true;
}

roundForm.addEventListener("submit", async event => {
    event.preventDefault();

    const driveId = Number(driveSelect.value);

    if (!driveId) {
        roundFormMessage.className =
            "status-message error-message";
        roundFormMessage.textContent =
            "Select a placement drive first.";
        return;
    }

    const scheduledValue =
        document.getElementById("roundScheduledAt").value;

    const roundData = {
        drive_id: driveId,
        round_number:
            Number(document.getElementById("roundNumber").value),
        round_name:
            document.getElementById("roundName").value.trim(),
        round_type:
            document.getElementById("roundType").value || null,
        scheduled_at: scheduledValue
            ? new Date(scheduledValue).toISOString()
            : null,
        venue:
            document.getElementById("roundVenue").value.trim()
            || null,
        round_status:
            document.getElementById("roundStatus").value,
        updated_at: new Date().toISOString()
    };

    const roundId =
        document.getElementById("roundRecordId").value;

    const button = document.getElementById("saveRoundButton");
    button.disabled = true;

    let result;

    if (roundId) {
        result = await supabaseClient
            .from("drive_rounds")
            .update(roundData)
            .eq("id", roundId);
    } else {
        result = await supabaseClient
            .from("drive_rounds")
            .insert(roundData);
    }

    button.disabled = false;

    if (result.error) {
        roundFormMessage.className =
            "status-message error-message";
        roundFormMessage.textContent =
            result.error.code === "23505"
                ? "This round number already exists for the drive."
                : `Unable to save round: ${result.error.message}`;
        return;
    }

    resetRoundForm();

    roundFormMessage.className =
        "status-message success-message";
    roundFormMessage.textContent =
        roundId
            ? "Drive round updated successfully."
            : "Drive round created successfully.";

    await loadDriveData();
});

document
    .getElementById("cancelRoundEdit")
    .addEventListener("click", () => {
        resetRoundForm();
        roundFormMessage.textContent = "";
    });

async function loadRoundAttendance(roundId) {
    selectedRoundId = Number(roundId);

    const round = rounds.find(item => item.id === selectedRoundId);

    attendanceHeading.textContent =
        `Attendance: Round ${round.round_number} – ${round.round_name}`;

    attendanceMessage.textContent = "Loading attendance...";

    const { data, error } = await supabaseClient
        .from("drive_round_attendance")
        .select("*")
        .eq("round_id", selectedRoundId);

    if (error) {
        attendanceMessage.className =
            "status-message error-message";
        attendanceMessage.textContent =
            `Unable to load attendance: ${error.message}`;
        return;
    }

    const savedAttendance = new Map(
        (data || []).map(record => [
            record.participation_id,
            record
        ])
    );

    renderAttendanceRows(savedAttendance);

    attendanceMessage.className = "status-message";
    attendanceMessage.textContent =
        `${participationRecords.length} participating student${
            participationRecords.length === 1 ? "" : "s"
        }`;
}

function createSelect(options, selectedValue, className) {
    const select = document.createElement("select");
    select.className = className;

    options.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        option.selected = value === selectedValue;
        select.appendChild(option);
    });

    return select;
}

function renderAttendanceRows(savedAttendance) {
    roundAttendanceBody.replaceChildren();

    if (!participationRecords.length) {
        roundAttendanceBody.innerHTML =
            `<tr><td colspan="7">
                No students have been added to this drive.
            </td></tr>`;
        return;
    }

    participationRecords.forEach(participation => {
        const saved = savedAttendance.get(participation.id);
        const row = document.createElement("tr");

        row.dataset.participationId = participation.id;
        row.dataset.search = [
            participation.students?.university_id,
            participation.students?.student_name,
            participation.students?.branch
        ].join(" ").toLowerCase();

        addCell(row, participation.students?.university_id);
        addCell(row, participation.students?.student_name);
        addCell(row, participation.students?.branch);

        const attendanceCell = document.createElement("td");
        attendanceCell.appendChild(
            createSelect(
                [
                    "Not Marked",
                    "Present",
                    "Absent",
                    "Late",
                    "Excused"
                ],
                saved?.attendance_status || "Not Marked",
                "round-attendance-status"
            )
        );
        row.appendChild(attendanceCell);

        const resultCell = document.createElement("td");
        resultCell.appendChild(
            createSelect(
                [
                    "Awaiting Result",
                    "Cleared",
                    "Not Cleared",
                    "Not Applicable"
                ],
                saved?.result_status || "Awaiting Result",
                "round-result-status"
            )
        );
        row.appendChild(resultCell);

        const scoreCell = document.createElement("td");
        const scoreInput = document.createElement("input");
        scoreInput.type = "number";
        scoreInput.step = "0.01";
        scoreInput.className = "round-score";
        scoreInput.value = saved?.score ?? "";
        scoreCell.appendChild(scoreInput);
        row.appendChild(scoreCell);

        const remarksCell = document.createElement("td");
        const remarksInput = document.createElement("input");
        remarksInput.type = "text";
        remarksInput.className = "round-remarks";
        remarksInput.value = saved?.remarks ?? "";
        remarksCell.appendChild(remarksInput);
        row.appendChild(remarksCell);

        roundAttendanceBody.appendChild(row);
    });
}

document
    .getElementById("markAllPresent")
    .addEventListener("click", () => {
        roundAttendanceBody
            .querySelectorAll("tr:not([hidden]) .round-attendance-status")
            .forEach(select => {
                select.value = "Present";
            });
    });

roundStudentSearch.addEventListener("input", () => {
    const term = roundStudentSearch.value.trim().toLowerCase();

    roundAttendanceBody.querySelectorAll("tr").forEach(row => {
        if (!row.dataset.search) {
            return;
        }

        row.hidden = Boolean(term) &&
            !row.dataset.search.includes(term);
    });
});

document
    .getElementById("saveAllRoundAttendance")
    .addEventListener("click", async () => {
        if (!selectedRoundId) {
            attendanceMessage.className =
                "status-message error-message";
            attendanceMessage.textContent =
                "Select a drive round first.";
            return;
        }

        const rows = [
            ...roundAttendanceBody.querySelectorAll(
                "tr[data-participation-id]"
            )
        ];

        if (!rows.length) {
            attendanceMessage.className =
                "status-message error-message";
            attendanceMessage.textContent =
                "No participation records are available.";
            return;
        }

        const records = rows.map(row => ({
            round_id: selectedRoundId,
            participation_id:
                Number(row.dataset.participationId),
            attendance_status:
                row.querySelector(".round-attendance-status").value,
            result_status:
                row.querySelector(".round-result-status").value,
            score:
                row.querySelector(".round-score").value === ""
                    ? null
                    : Number(row.querySelector(".round-score").value),
            remarks:
                row.querySelector(".round-remarks").value.trim()
                || null,
            updated_at: new Date().toISOString()
        }));

        attendanceMessage.className = "status-message";
        attendanceMessage.textContent = "Saving attendance...";

        const { error } = await supabaseClient
            .from("drive_round_attendance")
            .upsert(records, {
                onConflict: "round_id,participation_id"
            });

        if (error) {
            attendanceMessage.className =
                "status-message error-message";
            attendanceMessage.textContent =
                `Unable to save attendance: ${error.message}`;
            return;
        }

        attendanceMessage.className =
            "status-message success-message";
        attendanceMessage.textContent =
            "Round attendance and results saved successfully.";
    });

driveSelect.addEventListener("change", async () => {
    resetRoundForm();
    await loadDriveData();
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseRoundPage() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        await loadDrives();
    }
}

initialiseRoundPage();
